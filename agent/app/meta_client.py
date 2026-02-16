import json
import requests
import logging
from typing import Dict, List, Optional, Any
from pathlib import Path

logger = logging.getLogger(__name__)

class MetaAPIClient:
    """Client for interacting with Meta's Marketing API"""
    
    def __init__(self, config_path: str = "config/meta_config.json"):
        self.config = self._load_config(config_path)
        self.base_url = self.config["meta_api"]["base_url"]
        self.access_token = self.config["meta_api"]["access_token"]
        self.ad_account_id = self.config["meta_api"]["ad_account_id"]
        self.app_id = self.config["meta_api"]["app_id"]
        self.timeout = self.config["meta_api"]["timeout"]
        
    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load configuration from JSON file"""
        try:
            config_file = Path(config_path)
            if not config_file.exists():
                raise FileNotFoundError(f"Config file not found: {config_path}")
            
            with open(config_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            raise
    
    def _make_request(self, endpoint: str, method: str = "GET", data: Optional[Dict] = None) -> Dict[str, Any]:
        """Make a request to Meta's API"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        
        try:
            if method == "GET":
                response = requests.get(url, headers=headers, timeout=self.timeout)
            elif method == "POST":
                response = requests.post(url, headers=headers, json=data, timeout=self.timeout)
            elif method == "PUT":
                response = requests.put(url, headers=headers, json=data, timeout=self.timeout)
            elif method == "DELETE":
                response = requests.delete(url, headers=headers, timeout=self.timeout)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed: {e}")
            raise
    
    def get_app_info(self) -> Dict[str, Any]:
        """Get information about the Meta app"""
        endpoint = f"{self.app_id}"
        params = {"fields": "id,name"}
        # params = {"fields": "id,name,category,link,privacy_policy_url,terms_of_service_url"}
        response = self._make_request(f"{endpoint}?{'&'.join([f'{k}={v}' for k, v in params.items()])}")
        return response
    
    def get_ad_account_info(self) -> Dict[str, Any]:
        """Get information about the ad account"""
        endpoint = f"act_{self.ad_account_id}"
        params = {"fields": "id,account_id,currency,account_status,timezone_name"}
        response = self._make_request(f"{endpoint}?{'&'.join([f'{k}={v}' for k, v in params.items()])}")
        return response
    
    def get_campaigns(self, limit: int = 25) -> List[Dict[str, Any]]:
        """Get campaigns from the ad account"""
        endpoint = f"act_{self.ad_account_id}/campaigns"
        params = {"limit": limit, "fields": "id,name,status,objective,created_time,updated_time,daily_budget,lifetime_budget"}
        response = self._make_request(f"{endpoint}?{'&'.join([f'{k}={v}' for k, v in params.items()])}")
        return response.get("data", [])
    
    def get_insights(self, date_preset: str = "today") -> Dict[str, Any]:
        """Get insights/metrics for the ad account"""
        endpoint = f"act_{self.ad_account_id}/insights"
        params = {
            "date_preset": date_preset,
            "fields": "spend,impressions,clicks,ctr,cpc,cpm,reach,frequency"
        }
        response = self._make_request(f"{endpoint}?{'&'.join([f'{k}={v}' for k, v in params.items()])}")
        return response.get("data", [{}])[0] if response.get("data") else {}
    
    def get_ad_sets(self, campaign_id: str, limit: int = 25, date_preset: str = "last_30d") -> List[Dict[str, Any]]:
        """Get ad sets for a specific campaign with performance metrics

        Args:
            campaign_id: The campaign ID to fetch ad sets for
            limit: Maximum number of ad sets to return
            date_preset: Date range for insights (e.g., 'last_30d', 'last_7d')

        Returns:
            List of ad sets with their performance metrics
        """
        # Build the endpoint URL with access_token as query parameter (required by Meta API)
        url = f"{self.base_url}/{campaign_id}/adsets"

        # Include insights fields for performance metrics
        fields = (
            "id,name,status,effective_status,daily_budget,lifetime_budget,"
            "optimization_goal,created_time,updated_time,targeting,bid_strategy,pacing_type,"
            "insights.date_preset({date_preset}){{spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,"
            "actions,action_values,cost_per_action_type}}"
        ).format(date_preset=date_preset)

        params = {
            "access_token": self.access_token,
            "limit": limit,
            "fields": fields,
        }

        try:
            response = requests.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            data = response.json()
            ad_sets = data.get("data", [])

            # Normalize insights structure for each ad set
            for ad_set in ad_sets:
                if "insights" in ad_set:
                    insights_data = ad_set["insights"]
                    if isinstance(insights_data, dict) and "data" in insights_data:
                        insights_list = insights_data["data"]
                    elif isinstance(insights_data, list):
                        insights_list = insights_data
                    else:
                        insights_list = []

                    ad_set["performance_metrics"] = insights_list[0] if insights_list else {}
                    del ad_set["insights"]
                else:
                    ad_set["performance_metrics"] = {}

            # Handle pagination
            while "paging" in data and "next" in data["paging"]:
                try:
                    next_url = data["paging"]["next"]
                    response = requests.get(next_url, timeout=self.timeout)
                    response.raise_for_status()
                    data = response.json()

                    # Normalize insights for paginated results
                    for ad_set in data.get("data", []):
                        if "insights" in ad_set:
                            insights_data = ad_set["insights"]
                            if isinstance(insights_data, dict) and "data" in insights_data:
                                insights_list = insights_data["data"]
                            elif isinstance(insights_data, list):
                                insights_list = insights_data
                            else:
                                insights_list = []

                            ad_set["performance_metrics"] = insights_list[0] if insights_list else {}
                            del ad_set["insights"]
                        else:
                            ad_set["performance_metrics"] = {}

                    ad_sets.extend(data.get("data", []))
                except Exception as e:
                    logger.warning(f"Failed to fetch next page of ad sets: {e}")
                    break

            return ad_sets

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get ad sets for campaign {campaign_id}: {e}")
            raise
    
    def get_ads(self, ad_set_id: str, limit: int = 25) -> List[Dict[str, Any]]:
        """Get ads for a specific ad set"""
        url = f"{self.base_url}/{ad_set_id}/ads"
        params = {
            "access_token": self.access_token,
            "limit": limit,
            "fields": "id,name,status,effective_status,creative,created_time,updated_time"
        }

        try:
            response = requests.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            return response.json().get("data", [])
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get ads for ad set {ad_set_id}: {e}")
            raise
    
    def create_campaign(self, name: str, objective: str, status: str = "PAUSED") -> Dict[str, Any]:
        """Create a new campaign"""
        endpoint = f"act_{self.ad_account_id}/campaigns"
        data = {
            "name": name,
            "objective": objective,
            "status": status
        }
        return self._make_request(endpoint, method="POST", data=data)
    
    def get_campaigns_detailed(self, limit: int = 25, date_preset: str = "last_30d") -> List[Dict[str, Any]]:
        """Get campaigns with detailed ad sets and ads using nested field requests
        
        Uses Meta API's nested field syntax to fetch campaigns, ad sets, and ads
        in a single API call to avoid rate limits.
        Includes insights (spend, impressions, clicks, etc.) using nested insights fields.
        
        Enhanced with additional metrics for optimization modules:
        - Video metrics (video_3_sec_watched_actions, video_thruplay_watched_actions)
        - Landing page metrics (landing_page_views, outbound_clicks)
        - Conversion actions
        - Action values for ROAS calculation
        
        Reference: 
        - https://stackoverflow.com/questions/68576154/facebook-developer-apis-trying-to-fetch-all-the-campaigns-adsets-and-ads
        - https://stackoverflow.com/questions/60916171/how-can-i-get-the-amount-spent-faceook-marketing-api
        - https://developers.facebook.com/docs/marketing-api/reference/ads-insights/
        """
        endpoint = f"act_{self.ad_account_id}/campaigns"
        
        # Use nested fields to get campaigns with their ad sets and ads in a single call
        # Enhanced field list for optimization modules
        # Added: video metrics, landing page metrics, action_values for ROAS
        fields = (
            "id,name,status,objective,created_time,updated_time,daily_budget,lifetime_budget,"
            "insights{spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,"
            "actions,action_values,cost_per_action_type,"
            "video_30_sec_watched_actions,video_p25_watched_actions,video_p50_watched_actions,"
            "video_p75_watched_actions,video_p100_watched_actions,"
            "inline_link_clicks,outbound_clicks,landing_page_views},"
            "adsets{id,name,status,effective_status,daily_budget,lifetime_budget,optimization_goal,created_time,updated_time,"
            "targeting,bid_strategy,pacing_type,"
            "insights{spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,"
            "actions,action_values,cost_per_action_type,"
            "video_30_sec_watched_actions,video_p25_watched_actions,video_p50_watched_actions,"
            "video_p75_watched_actions,video_p100_watched_actions,"
            "inline_link_clicks,outbound_clicks,landing_page_views},"
            "ads{id,name,status,effective_status,creative{id,name,object_story_spec,asset_feed_spec},created_time,updated_time,"
            "insights{spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,"
            "actions,action_values,cost_per_action_type,"
            "video_30_sec_watched_actions,video_p25_watched_actions,video_p50_watched_actions,"
            "video_p75_watched_actions,video_p100_watched_actions,"
            "inline_link_clicks,outbound_clicks,landing_page_views}}}"
        )
        
        params = {
            "limit": limit,
            "fields": fields,
            "date_preset": date_preset  # Pass date_preset as a query parameter for insights
        }
        
        try:
            response = self._make_request(f"{endpoint}?{'&'.join([f'{k}={v}' for k, v in params.items()])}")
            campaigns = response.get("data", [])
            
            # Handle pagination if needed
            while "paging" in response and "next" in response["paging"]:
                try:
                    next_url = response["paging"]["next"]
                    # Extract the query string from the full URL
                    if "?" in next_url:
                        query_string = next_url.split("?")[1]
                        response = self._make_request(f"{endpoint}?{query_string}")
                        campaigns.extend(response.get("data", []))
                    else:
                        break
                except Exception as e:
                    logger.warning(f"Failed to fetch next page: {e}")
                    break
            
            # Normalize the structure - Meta API returns nested data in 'data' field
            for campaign in campaigns:
                # Normalize insights - Meta API returns insights as a list with one object
                if "insights" in campaign:
                    insights_data = campaign["insights"]
                    if isinstance(insights_data, dict) and "data" in insights_data:
                        insights_list = insights_data["data"]
                    elif isinstance(insights_data, list):
                        insights_list = insights_data
                    else:
                        insights_list = []
                    
                    # Extract the first insights object (or empty dict if none)
                    campaign["performance_metrics"] = insights_list[0] if insights_list else {}
                    del campaign["insights"]
                else:
                    campaign["performance_metrics"] = {}
                
                # Ensure ad_sets is a list
                # Meta API returns nested fields as objects with 'data' and 'paging' keys
                if "adsets" in campaign:
                    if isinstance(campaign["adsets"], dict) and "data" in campaign["adsets"]:
                        campaign["ad_sets"] = campaign["adsets"]["data"]
                    elif isinstance(campaign["adsets"], list):
                        # Sometimes it might already be a list
                        campaign["ad_sets"] = campaign["adsets"]
                    else:
                        campaign["ad_sets"] = []
                    # Remove the original 'adsets' key if it exists
                    if "adsets" in campaign:
                        del campaign["adsets"]
                else:
                    campaign["ad_sets"] = []
                
                # Normalize ads and insights within each ad set
                for ad_set in campaign.get("ad_sets", []):
                    # Normalize ad set insights
                    if "insights" in ad_set:
                        insights_data = ad_set["insights"]
                        if isinstance(insights_data, dict) and "data" in insights_data:
                            insights_list = insights_data["data"]
                        elif isinstance(insights_data, list):
                            insights_list = insights_data
                        else:
                            insights_list = []
                        
                        ad_set["performance_metrics"] = insights_list[0] if insights_list else {}
                        del ad_set["insights"]
                    else:
                        ad_set["performance_metrics"] = {}
                    
                    # Normalize ads
                    if "ads" in ad_set:
                        if isinstance(ad_set["ads"], dict) and "data" in ad_set["ads"]:
                            ad_set["ads"] = ad_set["ads"]["data"]
                        elif isinstance(ad_set["ads"], list):
                            # Sometimes it might already be a list
                            pass  # Already a list, no need to change
                        else:
                            ad_set["ads"] = []
                    else:
                        ad_set["ads"] = []
                    
                    # Normalize insights for each ad
                    for ad in ad_set.get("ads", []):
                        if "insights" in ad:
                            insights_data = ad["insights"]
                            if isinstance(insights_data, dict) and "data" in insights_data:
                                insights_list = insights_data["data"]
                            elif isinstance(insights_data, list):
                                insights_list = insights_data
                            else:
                                insights_list = []
                            
                            ad["performance_metrics"] = insights_list[0] if insights_list else {}
                            del ad["insights"]
                        else:
                            ad["performance_metrics"] = {}
            
            return campaigns
            
        except Exception as e:
            logger.error(f"Failed to get detailed campaigns: {e}")
            # Fallback to the old method if nested fields fail
            logger.warning("Falling back to separate API calls method")
            campaigns = self.get_campaigns(limit)
            
            for campaign in campaigns:
                try:
                    # Get ad sets for this campaign
                    ad_sets = self.get_ad_sets(campaign["id"], limit=50)
                    campaign["ad_sets"] = ad_sets
                    
                    # Get ads for each ad set
                    for ad_set in ad_sets:
                        try:
                            ads = self.get_ads(ad_set["id"], limit=50)
                            ad_set["ads"] = ads
                        except Exception as e:
                            logger.warning(f"Failed to get ads for ad set {ad_set.get('id')}: {e}")
                            ad_set["ads"] = []
                            
                except Exception as e:
                    logger.warning(f"Failed to get ad sets for campaign {campaign.get('id')}: {e}")
                    campaign["ad_sets"] = []
            
            return campaigns

    def update_ad_set_status(self, ad_set_id: str, status: str) -> Dict[str, Any]:
        """Update the status of an ad set (ACTIVE, PAUSED, ARCHIVED)
        
        According to Meta's Marketing API documentation:
        https://developers.facebook.com/docs/marketing-api/reference/ad-campaign/
        Updates should use POST with form data, not PUT with JSON.
        """
        endpoint = ad_set_id
        # Meta API requires form data, not JSON for updates
        data = {
            "status": status
        }
        
        try:
            # Meta API uses POST for updates, not PUT, and requires form data
            # According to Meta API docs, access_token can be in query params or form data
            url = f"{self.base_url}/{endpoint.lstrip('/')}"
            params = {
                "access_token": self.access_token
            }
            headers = {
                "Authorization": f"Bearer {self.access_token}"
                # Don't set Content-Type, let requests set it for form data
            }
            
            # Use POST with form data (data parameter) instead of PUT with JSON
            # Include access_token in query params as per Meta API documentation examples
            response = requests.post(url, headers=headers, params=params, data=data, timeout=self.timeout)
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.HTTPError as e:
            # If Meta API returns an error, log it and re-raise
            error_msg = f"Meta API error updating ad set {ad_set_id}: {e}"
            if hasattr(e, 'response') and e.response:
                try:
                    error_data = e.response.json()
                    if 'error' in error_data:
                        error_info = error_data['error']
                        error_msg = f"Meta API Error {error_info.get('code', '')}: {error_info.get('message', str(e))}"
                        logger.error(f"{error_msg} - Full response: {error_data}")
                except:
                    error_msg = f"{error_msg} - Response: {e.response.text}"
            logger.error(error_msg)
            raise
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed: {e}")
            raise

    def get_insights_with_breakdowns(
        self, 
        object_id: str, 
        breakdowns: List[str] = None,
        time_increment: str = None,
        date_preset: str = "last_30d"
    ) -> List[Dict[str, Any]]:
        """Get insights with breakdowns (e.g., by platform, time)
        
        Args:
            object_id: Campaign, AdSet, or Ad ID
            breakdowns: List of breakdown types (e.g., ['publisher_platform'], ['hourly_stats_aggregated_by_advertiser_time_zone'])
            time_increment: Time grouping ('1' for daily, 'all_days' for total)
            date_preset: Date range preset
            
        Returns:
            List of insights with breakdown dimensions
        """
        endpoint = f"{object_id}/insights"
        
        params = {
            "date_preset": date_preset,
            "fields": "spend,impressions,clicks,ctr,cpc,actions,action_values,reach,frequency",
        }
        
        if breakdowns:
            params["breakdowns"] = ",".join(breakdowns)
        
        if time_increment:
            params["time_increment"] = time_increment
            
        try:
            response = self._make_request(f"{endpoint}?{'&'.join([f'{k}={v}' for k, v in params.items()])}")
            return response.get("data", [])
        except Exception as e:
            logger.error(f"Failed to get insights with breakdowns: {e}")
            return []
    
    def get_platform_breakdown(self, object_id: str, date_preset: str = "last_30d") -> List[Dict[str, Any]]:
        """Get performance breakdown by platform (Facebook, Instagram, Audience Network, Messenger)
        
        Args:
            object_id: Campaign, AdSet, or Ad ID
            date_preset: Date range preset
            
        Returns:
            List of insights broken down by platform
        """
        return self.get_insights_with_breakdowns(
            object_id,
            breakdowns=["publisher_platform"],
            date_preset=date_preset
        )
    
    def get_hourly_breakdown(self, object_id: str, date_preset: str = "last_7d") -> List[Dict[str, Any]]:
        """Get performance breakdown by hour of day
        
        Args:
            object_id: Campaign, AdSet, or Ad ID
            date_preset: Date range preset
            
        Returns:
            List of insights broken down by hour
        """
        return self.get_insights_with_breakdowns(
            object_id,
            breakdowns=["hourly_stats_aggregated_by_advertiser_time_zone"],
            date_preset=date_preset
        )
    
    def get_time_comparison_insights(self, object_id: str) -> Dict[str, Any]:
        """Get insights for different time periods for comparison
        
        Fetches last 7 days and last 30 days for trend analysis
        
        Args:
            object_id: Campaign, AdSet, or Ad ID
            
        Returns:
            Dict with 'last_7d' and 'last_30d' insights
        """
        try:
            last_7d = self.get_insights_with_breakdowns(
                object_id,
                date_preset="last_7d"
            )
            last_30d = self.get_insights_with_breakdowns(
                object_id,
                date_preset="last_30d"
            )
            
            return {
                "last_7d": last_7d[0] if last_7d else {},
                "last_30d": last_30d[0] if last_30d else {}
            }
        except Exception as e:
            logger.error(f"Failed to get time comparison insights: {e}")
            return {"last_7d": {}, "last_30d": {}}
    
    def get_ad_comments(self, ad_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get comments for a specific ad
        
        Args:
            ad_id: Ad ID
            limit: Maximum number of comments to fetch
            
        Returns:
            List of comment objects
        """
        endpoint = f"{ad_id}/comments"
        params = {
            "limit": limit,
            "fields": "id,message,created_time,from,like_count,comment_count"
        }
        
        try:
            response = self._make_request(f"{endpoint}?{'&'.join([f'{k}={v}' for k, v in params.items()])}")
            comments = response.get("data", [])
            
            # Handle pagination for comments
            while "paging" in response and "next" in response["paging"] and len(comments) < limit:
                try:
                    next_url = response["paging"]["next"]
                    if "?" in next_url:
                        query_string = next_url.split("?")[1]
                        response = self._make_request(f"{endpoint}?{query_string}")
                        comments.extend(response.get("data", []))
                    else:
                        break
                except Exception as e:
                    logger.warning(f"Failed to fetch next page of comments: {e}")
                    break
            
            return comments[:limit]
        except Exception as e:
            logger.error(f"Failed to get ad comments: {e}")
            return []

    def update_ad_set_budget(self, ad_set_id: str, daily_budget: int = None, lifetime_budget: int = None) -> Dict[str, Any]:
        """Update the budget of an ad set (values in cents)

        Args:
            ad_set_id: The ID of the ad set to update
            daily_budget: New daily budget in cents (optional)
            lifetime_budget: New lifetime budget in cents (optional)

        Returns:
            Dict with the API response
        """
        url = f"{self.base_url}/{ad_set_id}"
        data = {}

        if daily_budget is not None:
            data["daily_budget"] = daily_budget
        if lifetime_budget is not None:
            data["lifetime_budget"] = lifetime_budget

        if not data:
            raise ValueError("At least one budget type (daily_budget or lifetime_budget) must be provided")

        try:
            response = requests.post(
                url,
                headers={"Authorization": f"Bearer {self.access_token}"},
                params={"access_token": self.access_token},
                data=data,
                timeout=self.timeout
            )
            response.raise_for_status()
            return response.json()

        except requests.exceptions.HTTPError as e:
            error_msg = f"Meta API error updating ad set budget {ad_set_id}: {e}"
            if hasattr(e, 'response') and e.response:
                try:
                    error_data = e.response.json()
                    if 'error' in error_data:
                        error_info = error_data['error']
                        error_msg = f"Meta API Error {error_info.get('code', '')}: {error_info.get('message', str(e))}"
                        logger.error(f"{error_msg} - Full response: {error_data}")
                except:
                    error_msg = f"{error_msg} - Response: {e.response.text}"
            logger.error(error_msg)
            raise
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed: {e}")
            raise

    def create_automated_rule(
        self,
        name: str,
        evaluation_spec: Dict[str, Any],
        execution_spec: Dict[str, Any],
        schedule_spec: Dict[str, Any] = None,
        status: str = "ENABLED"
    ) -> Dict[str, Any]:
        """Create an automated rule on Meta's servers

        Meta Automated Rules use filters within evaluation_spec to scope which entities
        the rule applies to. Required filters include:
        - entity_type: "AD", "ADSET", or "CAMPAIGN"
        - time_preset: "LAST_7D", "LAST_14D", "LAST_30D", "LIFETIME", etc.
        - campaign.id or adset.id: with IN operator to scope to specific campaigns/ad sets

        Args:
            name: Rule name
            evaluation_spec: Evaluation specification with filters (must include entity_type,
                            time_preset, and campaign.id/adset.id scoping filters)
            execution_spec: Execution specification with action type
            schedule_spec: Schedule specification (optional, defaults to daily)
            status: Rule status - ENABLED or DISABLED

        Returns:
            Dict with the created rule data including ID

        Reference: https://developers.facebook.com/docs/marketing-api/reference/ad-rules-library/
        """
        url = f"{self.base_url}/act_{self.ad_account_id}/adrules_library"

        # Default schedule: run daily
        if schedule_spec is None:
            schedule_spec = {
                "schedule_type": "DAILY"
            }

        data = {
            "access_token": self.access_token,
            "name": name,
            "evaluation_spec": json.dumps(evaluation_spec) if isinstance(evaluation_spec, dict) else evaluation_spec,
            "execution_spec": json.dumps(execution_spec) if isinstance(execution_spec, dict) else execution_spec,
            "schedule_spec": json.dumps(schedule_spec) if isinstance(schedule_spec, dict) else schedule_spec,
            "status": status
        }

        try:
            response = requests.post(url, data=data, timeout=self.timeout)
            response.raise_for_status()
            return response.json()

        except requests.exceptions.HTTPError as e:
            error_msg = f"Meta API error creating automated rule: {e}"
            if hasattr(e, 'response') and e.response:
                try:
                    error_data = e.response.json()
                    if 'error' in error_data:
                        error_info = error_data['error']
                        error_msg = f"Meta API Error {error_info.get('code', '')}: {error_info.get('message', str(e))}"
                        logger.error(f"{error_msg} - Full response: {error_data}")
                except:
                    error_msg = f"{error_msg} - Response: {e.response.text}"
            logger.error(error_msg)
            raise
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed: {e}")
            raise

    def get_automated_rules(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get all automated rules for the ad account"""
        url = f"{self.base_url}/act_{self.ad_account_id}/adrules_library"
        params = {
            "access_token": self.access_token,
            "fields": "id,name,status,evaluation_spec,execution_spec,schedule_spec,created_time,updated_time",
            "limit": limit
        }

        try:
            response = requests.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            return response.json().get("data", [])
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get automated rules: {e}")
            raise

    def delete_automated_rule(self, rule_id: str) -> Dict[str, Any]:
        """Delete an automated rule"""
        url = f"{self.base_url}/{rule_id}"
        params = {"access_token": self.access_token}

        try:
            response = requests.delete(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to delete automated rule {rule_id}: {e}")
            raise

    def update_automated_rule_status(self, rule_id: str, status: str) -> Dict[str, Any]:
        """Update the status of an automated rule (ENABLED/DISABLED)

        Args:
            rule_id: The ID of the rule to update
            status: New status - 'ENABLED' or 'DISABLED'

        Returns:
            Dict with the API response
        """
        url = f"{self.base_url}/{rule_id}"
        data = {
            "access_token": self.access_token,
            "status": status
        }

        try:
            response = requests.post(url, data=data, timeout=self.timeout)
            response.raise_for_status()
            return response.json()

        except requests.exceptions.HTTPError as e:
            error_msg = f"Meta API error updating rule status: {e}"
            if hasattr(e, 'response') and e.response:
                try:
                    error_data = e.response.json()
                    if 'error' in error_data:
                        error_info = error_data['error']
                        error_msg = f"Meta API Error {error_info.get('code', '')}: {error_info.get('message', str(e))}"
                except:
                    error_msg = f"{error_msg} - Response: {e.response.text}"
            logger.error(error_msg)
            raise
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to update automated rule status: {e}")
            raise

    def test_connection(self) -> bool:
        """Test the connection to Meta's API"""
        try:
            self.get_ad_account_info()
            return True
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return False
