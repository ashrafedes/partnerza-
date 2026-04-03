const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * Get domain from database settings or fallback to environment/default
 */
function getDomain() {
  try {
    const setting = db.prepare("SELECT value FROM platform_settings WHERE key = 'site_domain'").get();
    if (setting?.value) {
      return setting.value.replace(/\/+$/, '');
    }
  } catch (e) {
    console.error('getDomain - DB error:', e.message);
  }
  return (process.env.SITE_DOMAIN || 'http://localhost:3001').replace(/\/+$/, '');
}

/**
 * Get image base URL - uses site domain with /uploads path
 * Images are served from the same domain as the site
 */
function getImageBaseUrl(domain) {
  // Use the site domain directly - images are at /uploads on the same domain
  return domain;
}

/**
 * Get all product images from product_images table
 */
function getProductImages(productId) {
  return db.prepare(`
    SELECT filename 
    FROM product_images 
    WHERE product_id = ? 
    ORDER BY sort_order, id
  `).all(productId);
}

/**
 * Escape XML special characters
 */
function escapeXml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate XML Sitemap with product images
 * Compatible with Google Search Console
 */
function generateSitemapXML(products, imagesMap) {
  const domain = getDomain();
  const imageBaseUrl = getImageBaseUrl(domain);
  const today = new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

  // Static pages
  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/marketplace', priority: '0.9', changefreq: 'daily' },
    { url: '/login', priority: '0.5', changefreq: 'monthly' },
    { url: '/register', priority: '0.5', changefreq: 'monthly' },
  ];

  staticPages.forEach(page => {
    xml += `  <url>\n`;
    xml += `    <loc>${domain}${page.url}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += `  </url>\n`;
  });

  // Product pages with images
  products.forEach(product => {
    const lastmod = product.created_at || today;
    const productUrl = `/products/${product.id}`;
    const productImages = imagesMap[product.id] || [];

    xml += `  <url>\n`;
    xml += `    <loc>${domain}${productUrl}</loc>\n`;
    xml += `    <lastmod>${new Date(lastmod).toISOString()}</lastmod>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;

    // Add all images for this product
    if (productImages.length > 0) {
      productImages.forEach((img, index) => {
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${imageBaseUrl}/uploads/${img.filename}</image:loc>\n`;
        xml += `      <image:title>${escapeXml(product.name)}${index > 0 ? ` - Image ${index + 1}` : ''}</image:title>\n`;
        if (product.description && index === 0) {
          xml += `      <image:caption>${escapeXml(product.description.substring(0, 200))}</image:caption>\n`;
        }
        xml += `    </image:image>\n`;
      });
    } else if (product.main_image) {
      // Fallback to main_image if no images in product_images table
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${imageBaseUrl}/uploads/${product.main_image}</image:loc>\n`;
      xml += `      <image:title>${escapeXml(product.name)}</image:title>\n`;
      if (product.description) {
        xml += `      <image:caption>${escapeXml(product.description.substring(0, 200))}</image:caption>\n`;
      }
      xml += `    </image:image>\n`;
    }

    xml += `  </url>\n`;
  });

  xml += `</urlset>`;
  return xml;
}

/**
 * GET / - Main sitemap with all pages and product images
 */
router.get('/', async (req, res) => {
  try {
    // Fetch all active products (only columns that exist in the table)
    const products = db.prepare(`
      SELECT id, name, description, main_image, created_at
      FROM products
      WHERE status = 'active' OR status IS NULL
      ORDER BY id DESC
    `).all();

    // Fetch all product images and organize by product_id
    const allImages = db.prepare('SELECT product_id, filename FROM product_images').all();
    const imagesMap = {};
    allImages.forEach(img => {
      if (!imagesMap[img.product_id]) {
        imagesMap[img.product_id] = [];
      }
      imagesMap[img.product_id].push(img);
    });

    const sitemapXML = generateSitemapXML(products, imagesMap);

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(sitemapXML);

  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).json({
      error: 'Failed to generate sitemap',
      details: error.message
    });
  }
});

/**
 * GET /product-images - Dedicated image sitemap
 */
router.get('/product-images', async (req, res) => {
  try {
    const domain = getDomain();
    const imageBaseUrl = getImageBaseUrl(domain);

    // Fetch all active products with images
    const products = db.prepare(`
      SELECT p.id, p.name, p.main_image, p.created_at
      FROM products p
      WHERE (p.status = 'active' OR p.status IS NULL)
        AND (p.main_image IS NOT NULL OR EXISTS (
          SELECT 1 FROM product_images pi WHERE pi.product_id = p.id
        ))
      ORDER BY p.id DESC
    `).all();

    // Get all images
    const allImages = db.prepare('SELECT product_id, filename FROM product_images').all();
    const imagesMap = {};
    allImages.forEach(img => {
      if (!imagesMap[img.product_id]) {
        imagesMap[img.product_id] = [];
      }
      imagesMap[img.product_id].push(img);
    });

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
    xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

    products.forEach(product => {
      const productUrl = `/products/${product.id}`;
      const productImages = imagesMap[product.id] || [];

      if (productImages.length === 0 && !product.main_image) return;

      xml += `  <url>\n`;
      xml += `    <loc>${domain}${productUrl}</loc>\n`;

      // Add all images
      if (productImages.length > 0) {
        productImages.forEach(img => {
          xml += `    <image:image>\n`;
          xml += `      <image:loc>${imageBaseUrl}/uploads/${img.filename}</image:loc>\n`;
          xml += `      <image:title>${escapeXml(product.name)}</image:title>\n`;
          xml += `    </image:image>\n`;
        });
      } else if (product.main_image) {
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${imageBaseUrl}/uploads/${product.main_image}</image:loc>\n`;
        xml += `      <image:title>${escapeXml(product.name)}</image:title>\n`;
        xml += `    </image:image>\n`;
      }

      xml += `  </url>\n`;
    });

    xml += `</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(xml);

  } catch (error) {
    console.error('Error generating image sitemap:', error);
    res.status(500).json({ error: 'Failed to generate image sitemap', details: error.message });
  }
});

module.exports = router;
