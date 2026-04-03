import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const CurrencyContext = createContext();

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState('SAR');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/settings/currency')
      .then(res => {
        setCurrency(res.data.currency || 'SAR');
        setLoading(false);
      })
      .catch(() => {
        setCurrency('SAR');
        setLoading(false);
      });
  }, []);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, loading }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
