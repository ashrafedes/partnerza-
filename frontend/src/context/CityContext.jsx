import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';

const CityContext = createContext();

// Common Saudi and Egypt cities for fallback
const AVAILABLE_CITIES = [
  // Saudi Arabia
  'Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam', 'Khobar', 'Tabuk', 
  'Abha', 'Taif', 'Buraidah', 'Khamis Mushait', 'Hail', 'Najran', 
  'Yanbu', 'Al Jubail', 'Al Hofuf', 'Al Khafji', 'Arar', 'Jazan',
  // Egypt
  'Cairo', 'Alexandria', 'Giza', 'Sharm El-Sheikh', 'Hurghada', 'Luxor', 
  'Aswan', 'Port Said', 'Suez', 'Mansoura', 'Tanta', 'Ismailia',
  'Faiyum', 'Zagazig', 'Damietta', 'Asyut', 'Minya', 'Sohag',
  // UAE
  'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah',
  // Other
  'Kuwait City', 'Doha', 'Manama', 'Muscat', 'Amman', 'Beirut'
];

export function CityProvider({ children }) {
  const { user } = useAuth();
  const [city, setCity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSelector, setShowSelector] = useState(false);

  // Initialize: Check localStorage or detect from IP
  useEffect(() => {
    const initCity = async () => {
      // 1. Check if user has saved city in profile
      if (user?.preferred_city) {
        setCity(user.preferred_city);
        localStorage.setItem('preferredCity', user.preferred_city);
        setLoading(false);
        return;
      }

      // 2. Check localStorage for guest
      const savedCity = localStorage.getItem('preferredCity');
      if (savedCity) {
        setCity(savedCity);
        setLoading(false);
        return;
      }

      // 3. Try IP-based detection
      try {
        const response = await fetch('https://ipapi.co/json/');
        if (response.ok) {
          const data = await response.json();
          const detectedCity = data.city || 'Riyadh';
          setCity(detectedCity);
          localStorage.setItem('preferredCity', detectedCity);
          
          // If logged in, save to profile
          if (user) {
            await api.patch('/api/auth/preferred-city', { preferred_city: detectedCity });
          }
        }
      } catch (err) {
        // Fallback to Riyadh
        setCity('Riyadh');
        localStorage.setItem('preferredCity', 'Riyadh');
      }
      
      setLoading(false);
    };

    initCity();
  }, [user]);

  // Update when user changes
  useEffect(() => {
    if (user?.preferred_city && user.preferred_city !== city) {
      setCity(user.preferred_city);
      localStorage.setItem('preferredCity', user.preferred_city);
    }
  }, [user, city]);

  const setPreferredCity = async (newCity) => {
    setCity(newCity);
    localStorage.setItem('preferredCity', newCity);
    
    if (user) {
      try {
        await api.patch('/api/auth/preferred-city', { preferred_city: newCity });
      } catch (err) {
        console.error('Failed to save city to profile:', err);
      }
    }
    setShowSelector(false);
  };

  return (
    <CityContext.Provider value={{ 
      city, 
      loading, 
      AVAILABLE_CITIES,
      setPreferredCity,
      showSelector,
      setShowSelector
    }}>
      {children}
      
      {/* City Selector Modal */}
      {showSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Select Your City</h2>
            <p className="text-sm text-gray-600 mb-4">
              Choose your delivery location to see relevant products and shipping rates.
            </p>
            
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto mb-4">
              {AVAILABLE_CITIES.map((cityName) => (
                <button
                  key={cityName}
                  onClick={() => setPreferredCity(cityName)}
                  className={`p-2 text-sm rounded border text-left transition-colors ${
                    city === cityName 
                      ? 'bg-amazon-orange border-amazon-orange text-amazon-dark font-medium' 
                      : 'border-gray-200 hover:border-amazon-orange hover:bg-orange-50'
                  }`}
                >
                  {cityName}
                </button>
              ))}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowSelector(false)}
                className="flex-1 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </CityContext.Provider>
  );
}

export const useCity = () => {
  const context = useContext(CityContext);
  if (!context) {
    throw new Error('useCity must be used within a CityProvider');
  }
  return context;
};
