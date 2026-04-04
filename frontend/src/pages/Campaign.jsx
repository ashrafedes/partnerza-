import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCity } from '../context/CityContext';
import api from '../api/axios';

export default function Campaign() {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });
  const [campaignEnded, setCampaignEnded] = useState(false);
  const [stats, setStats] = useState({
    totalProducts: 0,
    offers: 0,
    newArrivals: 0
  });
  const { user, logout } = useAuth();
  const { city, loading: cityLoading, setShowSelector } = useCity();

  // Campaign end date - set to end of Ramadan 2026 (approximately March 22, 2026)
  const campaignEndDate = new Date('2026-03-22T23:59:59');

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const difference = campaignEndDate - now;

      if (difference <= 0) {
        setCampaignEnded(true);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, []);

  // Fetch campaign statistics
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get('/api/products');
        const products = data || [];
        
        // Calculate stats
        const offers = products.filter(p => p.marketer_commission_rate > 15).length;
        const newArrivals = products.filter(p => {
          const createdDate = new Date(p.created_at);
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return createdDate >= sevenDaysAgo;
        }).length;

        setStats({
          totalProducts: products.length,
          offers,
          newArrivals
        });
      } catch (error) {
        console.error('Failed to fetch campaign stats:', error);
      }
    };

    fetchStats();
  }, []);

  const TimeBlock = ({ value, label }) => (
    <div className="flex flex-col items-center">
      <div className="bg-amazon-dark text-white rounded-lg px-4 py-3 min-w-[70px] text-center">
        <span className="text-2xl md:text-3xl font-bold">
          {String(value).padStart(2, '0')}
        </span>
      </div>
      <span className="text-sm text-gray-600 mt-2 font-medium">{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-amazon-light" style={{ fontFamily: "'Amazon Ember', Arial, sans-serif" }}>
      {/* ===== TOP NAV ===== */}
      <nav className="bg-amazon-dark text-white h-[60px] flex items-center px-4 sticky top-0 z-50">
        {/* Logo */}
        <Link to="/" className="flex items-center mr-4 border border-transparent hover:border-white p-1 rounded-sm">
          <span className="text-xl font-bold text-white">Partnerza</span>
          <span className="text-amazon-orange text-xs ml-0.5">.sa</span>
        </Link>

        {/* Deliver to */}
        <div 
          onClick={() => setShowSelector(true)}
          className="hidden md:flex items-center mr-4 border border-transparent hover:border-white p-1 rounded-sm cursor-pointer"
        >
          <svg className="w-4 h-4 text-white mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
          <div className="text-xs leading-tight">
            <span className="text-gray-300">Delivering to {cityLoading ? '...' : city || 'Select city'}</span>
            <br />
            <span className="font-bold text-sm">Update location</span>
          </div>
        </div>

        <div className="flex-1" />

        {/* Right side */}
        <div className="flex items-center space-x-3 text-sm">
          {!user ? (
            <>
              <Link to="/login" className="border border-transparent hover:border-white p-1 rounded-sm">
                <span className="text-xs text-gray-300">Hello, sign in</span><br />
                <span className="font-bold text-sm">Account</span>
              </Link>
              <Link to="/register" className="border border-transparent hover:border-white p-1 rounded-sm bg-amazon-orange text-amazon-dark px-3 py-1 rounded-full font-bold">
                Register
              </Link>
            </>
          ) : (
            <div className="relative group">
              <div className="border border-transparent hover:border-white p-1 rounded-sm cursor-pointer leading-tight">
                <span className="text-xs text-gray-300">Hello, {user?.name}</span><br />
                <span className="font-bold text-sm">Account</span>
              </div>
              <div className="absolute right-0 mt-0 w-48 bg-white rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 border border-gray-200">
                <div className="p-3">
                  <button onClick={logout} className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">Sign Out</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* ===== SUB NAV ===== */}
      <div className="bg-[#232f3e] text-white h-[40px] flex items-center px-4 text-sm overflow-x-auto">
        <Link to="/" className="px-3 py-1 rounded-sm mr-2 hover:outline hover:outline-1 hover:outline-white">Home</Link>
        <Link to="/marketplace" className="px-3 py-1 rounded-sm mr-2 hover:outline hover:outline-1 hover:outline-white">Marketplace</Link>
        <Link to="/campaign" className="px-3 py-1 rounded-sm mr-2 bg-amazon-orange text-amazon-dark font-bold">العيد مظبوط</Link>
      </div>

      {/* ===== CAMPAIGN HERO SECTION ===== */}
      <div className="relative bg-gradient-to-r from-amazon-dark via-[#232f3e] to-amazon-dark text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            
            {/* Left: Campaign Info */}
            <div className="flex-1 text-center lg:text-right">
              <span className="inline-block bg-amazon-orange text-amazon-dark px-4 py-1 rounded-full text-sm font-bold mb-4">
                عروض العيد 2026
              </span>
              <h1 className="text-4xl md:text-6xl font-bold mb-4">
                العيد مظبوط
              </h1>
              <p className="text-xl md:text-2xl text-gray-300 mb-2">
                Eid Mabrook Campaign
              </p>
              <p className="text-gray-400 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                استمتع بأفضل العروض والمنتجات المختارة خصيصاً لعيد الأضحى المبارك. 
                خصومات حصرية على مجموعة واسعة من المنتجات مع توصيل سريع إلى جميع المدن.
                <br /><br />
                Enjoy the best offers and curated products for Eid Al-Adha. 
                Exclusive discounts on a wide range of products with fast delivery to all cities.
              </p>
            </div>

            {/* Center: Campaign Image */}
            <div className="flex-1 flex justify-center">
              <div className="relative">
                <div className="w-64 h-64 md:w-80 md:h-80 rounded-full bg-gradient-to-br from-amazon-orange to-orange-400 flex items-center justify-center shadow-2xl">
                  <div className="w-56 h-56 md:w-72 md:h-72 rounded-full bg-white flex items-center justify-center overflow-hidden">
                    <img 
                      src="/uploads/ramadan-campaign.jpg" 
                      alt="رمضان كريم"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNTAiIGN5PSIxNTAiIHI9IjE1MCIgZmlsbD0iI2Y5OWYxNyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iNDAiIGZpbGw9IiM2NDQ1MDkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7ZgdmG2KfYs9ipPC90ZXh0Pjwvc3ZnPg==';
                      }}
                    />
                  </div>
                </div>
                {/* Decorative elements */}
                <div className="absolute -top-4 -right-4 w-16 h-16 bg-yellow-400 rounded-full opacity-80 animate-pulse"></div>
                <div className="absolute -bottom-2 -left-4 w-12 h-12 bg-amazon-orange rounded-full opacity-60 animate-pulse delay-300"></div>
              </div>
            </div>

            {/* Right: Countdown Timer */}
            <div className="flex-1 text-center">
              <h3 className="text-lg font-bold mb-4 text-amazon-orange">
                ينتهي العرض خلال
                <br />
                <span className="text-white text-sm font-normal">Offer ends in</span>
              </h3>
              
              {campaignEnded ? (
                <div className="text-2xl font-bold text-red-400">
                  انتهت الحملة
                  <br />
                  <span className="text-lg">Campaign Ended</span>
                </div>
              ) : (
                <div className="flex justify-center gap-3">
                  <TimeBlock value={timeLeft.days} label="أيام" />
                  <TimeBlock value={timeLeft.hours} label="ساعات" />
                  <TimeBlock value={timeLeft.minutes} label="دقائق" />
                  <TimeBlock value={timeLeft.seconds} label="ثواني" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== STATISTICS SECTION ===== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Products */}
          <div className="bg-white rounded-lg shadow-lg border border-amazon-border p-6 text-center hover:shadow-xl transition-shadow">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-3xl font-bold text-amazon-dark mb-1">{stats.totalProducts}+</h3>
            <p className="text-gray-600 font-medium">منتج متاح</p>
            <p className="text-sm text-gray-500">Available Products</p>
          </div>

          {/* Offers */}
          <div className="bg-white rounded-lg shadow-lg border border-amazon-border p-6 text-center hover:shadow-xl transition-shadow">
            <div className="w-16 h-16 bg-amazon-orange bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amazon-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
            </div>
            <h3 className="text-3xl font-bold text-amazon-dark mb-1">{stats.offers}+</h3>
            <p className="text-gray-600 font-medium">عروض خاصة</p>
            <p className="text-sm text-gray-500">Special Offers</p>
          </div>

          {/* New Arrivals */}
          <div className="bg-white rounded-lg shadow-lg border border-amazon-border p-6 text-center hover:shadow-xl transition-shadow">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <h3 className="text-3xl font-bold text-amazon-dark mb-1">{stats.newArrivals}+</h3>
            <p className="text-gray-600 font-medium">وصل حديثاً</p>
            <p className="text-sm text-gray-500">New Arrivals</p>
          </div>
        </div>
      </div>

      {/* ===== CTA SECTION ===== */}
      <div className="bg-amazon-dark text-white py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            استفد من العروض الآن
          </h2>
          <p className="text-xl text-gray-300 mb-6">
            Don't miss out on these amazing Eid deals
          </p>
          <Link 
            to="/marketplace"
            className="inline-block bg-amazon-orange text-amazon-dark px-8 py-3 rounded-full font-bold text-lg hover:bg-orange-600 transition-colors"
          >
            تصفح المنتجات / Browse Products →
          </Link>
        </div>
      </div>

      {/* ===== FOOTER ===== */}
      <footer className="bg-[#232f3e] text-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-amazon-orange font-bold text-xl mb-2">العيد مظبوط</p>
          <p className="text-gray-400 text-sm">
            © 2026 Partnerza. جميع الحقوق محفوظة.
          </p>
        </div>
      </footer>
    </div>
  );
}
