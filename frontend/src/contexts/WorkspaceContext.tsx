import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { Agent, MetaCampaign } from '../types';

interface WorkspaceContextValue {
  agents: Agent[];
  selectedAgent: Agent | null;
  setSelectedAgent: (agent: Agent) => void;
  campaigns: MetaCampaign[];
  selectedCampaign: MetaCampaign | null;
  setSelectedCampaign: (campaign: MetaCampaign) => void;
  loading: boolean;
  campaignsLoading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  agents: [],
  selectedAgent: null,
  setSelectedAgent: () => {},
  campaigns: [],
  selectedCampaign: null,
  setSelectedCampaign: () => {},
  loading: true,
  campaignsLoading: false,
});

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<MetaCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [campaignsLoading, setCampaignsLoading] = useState(false);

  // Load agents on mount, auto-select first
  useEffect(() => {
    apiService
      .getAgents()
      .then((res) => {
        setAgents(res.data);
        if (res.data.length > 0) setSelectedAgent(res.data[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Load campaigns whenever selected agent changes
  useEffect(() => {
    if (!selectedAgent) return;
    setCampaignsLoading(true);
    setCampaigns([]);
    setSelectedCampaign(null);

    apiService
      .getMetaCampaigns(selectedAgent.id)
      .then((res) => {
        const list: MetaCampaign[] = res.data?.data ?? res.data ?? [];
        setCampaigns(list);
        if (list.length > 0) setSelectedCampaign(list[0]);
      })
      .catch(() => {})
      .finally(() => setCampaignsLoading(false));
  }, [selectedAgent]);

  return (
    <WorkspaceContext.Provider
      value={{
        agents,
        selectedAgent,
        setSelectedAgent,
        campaigns,
        selectedCampaign,
        setSelectedCampaign,
        loading,
        campaignsLoading,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => useContext(WorkspaceContext);
