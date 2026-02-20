import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { EvidenceItem, CourtOrder, BreachLog } from '../types';
import * as evidenceRepo from '../database/evidenceRepository';
import * as courtOrderRepo from '../database/courtOrderRepository';

interface DatabaseContextValue {
  evidence: EvidenceItem[];
  courtOrders: CourtOrder[];
  loading: boolean;
  refreshEvidence: () => Promise<void>;
  refreshCourtOrders: () => Promise<void>;
  getBreachesForOrder: (orderId: string) => Promise<BreachLog[]>;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [courtOrders, setCourtOrders] = useState<CourtOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshEvidence = useCallback(async () => {
    const items = await evidenceRepo.getAllEvidence();
    setEvidence(items);
  }, []);

  const refreshCourtOrders = useCallback(async () => {
    const orders = await courtOrderRepo.getAllCourtOrders();
    setCourtOrders(orders);
  }, []);

  const getBreachesForOrder = useCallback(async (orderId: string) => {
    return courtOrderRepo.getBreachLogsForOrder(orderId);
  }, []);

  useEffect(() => {
    Promise.all([refreshEvidence(), refreshCourtOrders()])
      .finally(() => setLoading(false));
  }, [refreshEvidence, refreshCourtOrders]);

  return (
    <DatabaseContext.Provider
      value={{
        evidence,
        courtOrders,
        loading,
        refreshEvidence,
        refreshCourtOrders,
        getBreachesForOrder,
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const ctx = useContext(DatabaseContext);
  if (!ctx) throw new Error('useDatabase must be used within DatabaseProvider');
  return ctx;
}
