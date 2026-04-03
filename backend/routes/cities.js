const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/verifyToken');
const https = require('https');

// Pre-defined list of major Egyptian cities with shipping rates
const EGYPT_CITIES = [
  { city: 'Cairo', cost: 25 },
  { city: 'Alexandria', cost: 30 },
  { city: 'Giza', cost: 25 },
  { city: 'Shubra El Kheima', cost: 30 },
  { city: 'Port Said', cost: 35 },
  { city: 'Suez', cost: 35 },
  { city: 'Luxor', cost: 40 },
  { city: 'al-Mansura', cost: 40 },
  { city: 'El-Mahalla El-Kubra', cost: 40 },
  { city: 'Tanta', cost: 35 },
  { city: 'Asyut', cost: 45 },
  { city: 'Ismailia', cost: 35 },
  { city: 'Fayyum', cost: 40 },
  { city: 'Zagazig', cost: 35 },
  { city: 'Aswan', cost: 50 },
  { city: 'Damietta', cost: 35 },
  { city: 'Damanhur', cost: 35 },
  { city: 'al-Minya', cost: 45 },
  { city: 'Beni Suef', cost: 40 },
  { city: 'Qena', cost: 45 },
  { city: 'Sohag', cost: 45 },
  { city: 'Hurghada', cost: 50 },
  { city: '6th of October City', cost: 30 },
  { city: 'Shibin El Kom', cost: 40 },
  { city: 'Banha', cost: 30 },
  { city: 'Kafr el-Sheikh', cost: 40 },
  { city: 'Arish', cost: 60 },
  { city: 'Mallawi', cost: 45 },
  { city: 'Bilbeis', cost: 35 },
  { city: 'Marsa Matruh', cost: 70 }
];

// Seed Egyptian cities into database
function seedEgyptCities() {
  const existingCities = db.prepare('SELECT COUNT(*) as count FROM cities WHERE country = ?').get('Egypt');
  if (existingCities.count > 0) return; // Already seeded

  const insertCity = db.prepare('INSERT OR IGNORE INTO cities (country, city) VALUES (?, ?)');
  const insertShipping = db.prepare('INSERT OR IGNORE INTO shipping_rates (city, country, cost, is_active) VALUES (?, ?, ?, 1)');

  for (const cityData of EGYPT_CITIES) {
    insertCity.run('Egypt', cityData.city);
    insertShipping.run(cityData.city, 'Egypt', cityData.cost);
  }
  console.log('Seeded Egypt cities');
}

// Seed on module load
seedEgyptCities();

// Fetch cities from external API (using GeoNames or similar)
async function fetchCitiesFromExternalAPI(countryName) {
  return new Promise((resolve, reject) => {
    // Using GeoNames API (requires username, using demo for now)
    // For production, you should get a free API key from geonames.org
    const countryCode = getCountryCode(countryName);
    if (!countryCode) {
      reject(new Error('Country code not found'));
      return;
    }

    const options = {
      hostname: 'api.geonames.org',
      path: `/searchJSON?country=${countryCode}&featureClass=P&maxRows=1000&username=demo`,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          if (jsonData.geonames && Array.isArray(jsonData.geonames)) {
            const cities = jsonData.geonames
              .filter(place => place.population > 10000) // Only cities with population > 10k
              .map(place => place.name)
              .slice(0, 50); // Limit to top 50 cities
            resolve(cities);
          } else {
            reject(new Error('Invalid response from GeoNames API'));
          }
        } catch (error) {
          reject(new Error('Failed to parse API response'));
        }
      });
    });

    req.on('error', (error) => {
      console.error('External API error:', error);
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('API request timeout'));
    });

    req.end();
  });
}

// Country name to ISO code mapping
function getCountryCode(countryName) {
  const countryMap = {
    'Egypt': 'EG',
    'Saudi Arabia': 'SA',
    'United Arab Emirates': 'AE',
    'Kuwait': 'KW',
    'Qatar': 'QA',
    'Bahrain': 'BH',
    'Oman': 'OM',
    'Jordan': 'JO',
    'Lebanon': 'LB',
    'Iraq': 'IQ',
    'Morocco': 'MA',
    'Algeria': 'DZ',
    'Tunisia': 'TN',
    'Libya': 'LY',
    'Sudan': 'SD',
    'Yemen': 'YE',
    'Syria': 'SY',
    'Palestine': 'PS',
    'Turkey': 'TR',
    'United States': 'US',
    'United Kingdom': 'GB',
    'Canada': 'CA',
    'Australia': 'AU',
    'Germany': 'DE',
    'France': 'FR',
    'Italy': 'IT',
    'Spain': 'ES',
    'Netherlands': 'NL',
    'Belgium': 'BE',
    'Switzerland': 'CH',
    'Austria': 'AT',
    'Sweden': 'SE',
    'Norway': 'NO',
    'Denmark': 'DK',
    'Finland': 'FI',
    'Poland': 'PL',
    'Russia': 'RU',
    'Ukraine': 'UA',
    'India': 'IN',
    'China': 'CN',
    'Japan': 'JP',
    'South Korea': 'KR',
    'Brazil': 'BR',
    'Argentina': 'AR',
    'Mexico': 'MX',
    'South Africa': 'ZA',
    'Nigeria': 'NG',
    'Kenya': 'KE',
    'Pakistan': 'PK',
    'Bangladesh': 'BD',
    'Indonesia': 'ID',
    'Malaysia': 'MY',
    'Thailand': 'TH',
    'Philippines': 'PH',
    'Singapore': 'SG',
    'New Zealand': 'NZ',
    'Ireland': 'IE',
    'Portugal': 'PT',
    'Greece': 'GR',
    'Czech Republic': 'CZ',
    'Hungary': 'HU',
    'Romania': 'RO',
    'Bulgaria': 'BG',
    'Croatia': 'HR',
    'Serbia': 'RS',
    'Slovenia': 'SI',
    'Slovakia': 'SK',
    'Lithuania': 'LT',
    'Latvia': 'LV',
    'Estonia': 'EE',
    'Iceland': 'IS',
    'Luxembourg': 'LU',
    'Malta': 'MT',
    'Cyprus': 'CY',
    'Israel': 'IL',
    'Iran': 'IR',
    'Afghanistan': 'AF',
    'Uzbekistan': 'UZ',
    'Kazakhstan': 'KZ',
    'Turkmenistan': 'TM',
    'Tajikistan': 'TJ',
    'Kyrgyzstan': 'KG',
    'Azerbaijan': 'AZ',
    'Armenia': 'AM',
    'Georgia': 'GE',
    'Moldova': 'MD',
    'Belarus': 'BY',
    'Estonia': 'EE'
  };
  return countryMap[countryName];
}

// GET /api/cities/:country - Get cities by country
router.get('/:country', async (req, res) => {
  try {
    const { country } = req.params;
    
    if (!country) {
      return res.status(400).json({ error: 'Country parameter is required' });
    }

    // Check if we have cities for this country in the database
    let cities = db.prepare('SELECT city FROM cities WHERE country = ? ORDER BY city ASC').all(country);
    
    // If Egypt and no cities, seed them
    if (country === 'Egypt' && cities.length === 0) {
      seedEgyptCities();
      cities = db.prepare('SELECT city FROM cities WHERE country = ? ORDER BY city ASC').all(country);
    }
    
    // If no cities found and not Egypt, try to fetch from external API
    if (cities.length === 0 && country !== 'Egypt') {
      try {
        const externalCities = await fetchCitiesFromExternalAPI(country);
        if (externalCities && externalCities.length > 0) {
          // Insert fetched cities into database
          const insertStmt = db.prepare('INSERT OR IGNORE INTO cities (country, city) VALUES (?, ?)');
          const insertShipping = db.prepare('INSERT OR IGNORE INTO shipping_rates (city, country, cost, is_active) VALUES (?, ?, ?, 1)');
          
          for (const cityName of externalCities) {
            insertStmt.run(country, cityName);
            insertShipping.run(cityName, country, 50); // Default shipping cost
          }
          
          // Fetch again from database
          cities = db.prepare('SELECT city FROM cities WHERE country = ? ORDER BY city ASC').all(country);
        }
      } catch (apiError) {
        console.error('External API fetch failed:', apiError);
        // Return some default major cities for common countries as fallback
        const fallbackCities = getFallbackCities(country);
        if (fallbackCities.length > 0) {
          const insertStmt = db.prepare('INSERT OR IGNORE INTO cities (country, city) VALUES (?, ?)');
          const insertShipping = db.prepare('INSERT OR IGNORE INTO shipping_rates (city, country, cost, is_active) VALUES (?, ?, ?, 1)');
          
          for (const cityName of fallbackCities) {
            insertStmt.run(country, cityName);
            insertShipping.run(cityName, country, 50);
          }
          cities = db.prepare('SELECT city FROM cities WHERE country = ? ORDER BY city ASC').all(country);
        }
      }
    }

    res.json(cities.map(c => c.city));
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

// Fallback cities for common countries
function getFallbackCities(country) {
  const fallback = {
    'Saudi Arabia': ['Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam', 'Taif', 'Tabuk', 'Buraidah', 'Khamis Mushait', 'Abha'],
    'United Arab Emirates': ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'],
    'Kuwait': ['Kuwait City', 'Hawalli', 'Salmiya', 'Jahra', 'Fahaheel', 'Ahmadi'],
    'Qatar': ['Doha', 'Al Rayyan', 'Al Wakrah', 'Al Khor', 'Umm Salal'],
    'Bahrain': ['Manama', 'Riffa', 'Muharraq', 'Hamad Town', 'Isa Town'],
    'Oman': ['Muscat', 'Salalah', 'Sohar', 'Nizwa', 'Sur', 'Bahla'],
    'Jordan': ['Amman', 'Zarqa', 'Irbid', 'Russeifa', 'Aqaba', 'Madaba'],
    'Lebanon': ['Beirut', 'Tripoli', 'Sidon', 'Tyre', 'Byblos', 'Zahle'],
    'Iraq': ['Baghdad', 'Basra', 'Mosul', 'Erbil', 'Sulaymaniyah', 'Najaf'],
    'Morocco': ['Casablanca', 'Rabat', 'Marrakech', 'Fes', 'Tangier', 'Agadir'],
    'Algeria': ['Algiers', 'Oran', 'Constantine', 'Annaba', 'Blida', 'Batna'],
    'Tunisia': ['Tunis', 'Sfax', 'Sousse', 'Kairouan', 'Bizerte', 'Gabes'],
    'Libya': ['Tripoli', 'Benghazi', 'Misrata', 'Bayda', 'Zawiya', 'Ajdabiya'],
    'Sudan': ['Khartoum', 'Omdurman', 'Port Sudan', 'Kassala', 'El Obeid', 'Nyala'],
    'Yemen': ['Sanaa', 'Aden', 'Taiz', 'Hodeidah', 'Mukalla', 'Ibb'],
    'Syria': ['Damascus', 'Aleppo', 'Homs', 'Latakia', 'Hama', 'Raqqa'],
    'Turkey': ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya', 'Adana'],
    'United States': ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia'],
    'United Kingdom': ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Sheffield'],
    'Germany': ['Berlin', 'Munich', 'Hamburg', 'Cologne', 'Frankfurt', 'Stuttgart'],
    'France': ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes'],
    'Italy': ['Rome', 'Milan', 'Naples', 'Turin', 'Palermo', 'Genoa'],
    'Spain': ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Zaragoza', 'Malaga']
  };
  return fallback[country] || [];
}

// GET /api/cities - Get all available countries
router.get('/', (req, res) => {
  try {
    const countries = db.prepare('SELECT DISTINCT country FROM cities ORDER BY country ASC').all();
    res.json(countries.map(c => c.country));
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

// POST /api/cities/:country/refresh - Refresh cities from external API (authenticated)
router.post('/:country/refresh', verifyToken, async (req, res) => {
  try {
    const { country } = req.params;
    
    if (!country) {
      return res.status(400).json({ error: 'Country parameter is required' });
    }

    // Skip for Egypt (pre-defined)
    if (country === 'Egypt') {
      return res.json({ message: 'Egypt cities are pre-defined and cannot be refreshed' });
    }

    // Try to fetch from external API
    try {
      const externalCities = await fetchCitiesFromExternalAPI(country);
      if (externalCities && externalCities.length > 0) {
        // Clear existing cities for this country
        db.prepare('DELETE FROM cities WHERE country = ?').run(country);
        
        // Insert new cities
        const insertStmt = db.prepare('INSERT INTO cities (country, city) VALUES (?, ?)');
        const insertShipping = db.prepare('INSERT OR IGNORE INTO shipping_rates (city, country, cost, is_active) VALUES (?, ?, ?, 1)');
        
        for (const cityName of externalCities) {
          insertStmt.run(country, cityName);
          insertShipping.run(cityName, country, 50);
        }
        
        res.json({ 
          message: `Successfully refreshed cities for ${country}`,
          count: externalCities.length
        });
      } else {
        res.status(404).json({ error: 'No cities found from external API' });
      }
    } catch (apiError) {
      console.error('External API fetch failed:', apiError);
      res.status(500).json({ error: 'Failed to fetch from external API' });
    }
  } catch (error) {
    console.error('Error refreshing cities:', error);
    res.status(500).json({ error: 'Failed to refresh cities' });
  }
});

module.exports = router;
