const axios = require('axios');

const TIMEOUT = 15000;

// ============================================================
// 推广时效性：按月份的季节性 + 节假日关键词映射
// ============================================================
const SEASONAL_MAP = {
  1: {
    label: '冬季/新年/春节筹备',
    keywords: {
      'winter': 3, 'jacket': 3, 'coat': 3, 'hoodie': 3, 'gloves': 3, 'scarf': 2,
      'new year': 2, 'fitness': 3, 'exercise': 2, 'gym': 2, 'resolution': 2,
      'valentine': 1, 'skincare': 2, 'moisturizer': 2, 'humidifier': 2,
      'snow': 2, 'thermal': 2, 'blanket': 2, 'heater': 2, 'tea': 1
    }
  },
  2: {
    label: '情人节/总统日/冬末',
    keywords: {
      'valentine': 4, 'love': 3, 'gift': 3, 'jewelry': 3, 'chocolate': 2, 'rose': 2,
      'president': 1, 'winter': 2, 'jacket': 1, 'skincare': 2, 'beauty': 2,
      'fitness': 2, 'gym': 2, 'outdoor': 1, 'football': 2, 'super bowl': 3,
      'heart': 2, 'couple': 2, 'date': 1
    }
  },
  3: {
    label: '春季开始/圣帕特里克/妇女节',
    keywords: {
      'spring': 3, 'garden': 3, 'planting': 2, 'outdoor': 2, 'patio': 2,
      'st patrick': 2, 'green': 1, 'women': 2, 'cleaning': 3, 'organize': 2,
      'easter': 2, 'bunny': 1, 'egg': 1, 'lawn': 2, 'bbq': 1, 'grill': 1,
      'sandals': 2, 't-shirt': 2, 'shorts': 1, 'sunglasses': 1
    }
  },
  4: {
    label: '复活节/地球日/春装',
    keywords: {
      'easter': 4, 'bunny': 2, 'egg': 2, 'spring': 3, 'garden': 3,
      'earth': 3, 'eco': 2, 'recycle': 2, 'sustainable': 2, 'organic': 2,
      'outdoor': 3, 'camping': 2, 'hiking': 2, 'patio': 2, 'bbq': 2, 'grill': 2,
      'rain': 2, 'umbrella': 2, 'jacket': 1, 'mother': 1, 'sandals': 2,
      'dress': 2, 'shorts': 2, 'sunglasses': 2, 'sunscreen': 1
    }
  },
  5: {
    label: '母亲节/Memorial Day/初夏',
    keywords: {
      'mother': 4, 'mom': 3, 'gift': 3, 'flower': 2, 'jewelry': 2, 'beauty': 2,
      'memorial': 2, 'outdoor': 3, 'bbq': 3, 'grill': 3, 'patio': 3, 'garden': 2,
      'summer': 2, 'swimwear': 2, 'bikini': 2, 'sunglasses': 3, 'sunscreen': 2,
      'camping': 3, 'hiking': 2, 'beach': 2, 'pool': 2, 'travel': 2,
      'sandals': 2, 'dress': 2, 'hat': 2, 'cooling': 1
    }
  },
  6: {
    label: '父亲节/Prime Day/夏季/毕业季',
    keywords: {
      'father': 4, 'dad': 3, 'gift': 3, 'tool': 2, 'watch': 2, 'wallet': 2,
      'prime': 3, 'deal': 2, 'electronic': 2, 'gadget': 2, 'tech': 2,
      'summer': 3, 'swimwear': 3, 'bikini': 2, 'beach': 3, 'pool': 3, 'sunglasses': 3,
      'sunscreen': 2, 'outdoor': 3, 'bbq': 3, 'grill': 3, 'patio': 3, 'garden': 2,
      'travel': 3, 'luggage': 2, 'wedding': 2, 'party': 2, 'fan': 2, 'cooling': 2
    }
  },
  7: {
    label: '独立日/夏季高峰/Prime Day/返校筹备',
    keywords: {
      'independence': 3, 'july': 2, 'patriotic': 2, 'flag': 2, 'firework': 2, 'party': 3,
      'prime': 4, 'deal': 3, 'electronic': 3, 'gadget': 3, 'tech': 3, 'smart': 2,
      'summer': 4, 'swimwear': 4, 'bikini': 3, 'beach': 4, 'pool': 4, 'sunglasses': 3,
      'sunscreen': 3, 'outdoor': 4, 'bbq': 4, 'grill': 4, 'patio': 3, 'garden': 2,
      'camping': 4, 'hiking': 3, 'travel': 3, 'luggage': 2, 'fan': 3, 'cooling': 3,
      'back to school': 2, 'backpack': 2, 'stationery': 1, 'laptop': 2, 'notebook': 1,
      'wedding': 2, 'water bottle': 2, 'hydration': 2, 'ice': 1, 'portable': 2
    }
  },
  8: {
    label: '返校季/夏末',
    keywords: {
      'back to school': 5, 'backpack': 4, 'school': 3, 'stationery': 3, 'laptop': 4,
      'notebook': 2, 'pen': 2, 'desk': 3, 'dorm': 4, 'college': 3, 'student': 3,
      'summer': 2, 'beach': 1, 'pool': 1, 'swimwear': 1, 'travel': 2,
      'fall': 1, 'jacket': 1, 'hoodie': 1, 'electronic': 2, 'tech': 2,
      'organize': 2, 'storage': 2, 'lunch': 2, 'water bottle': 2
    }
  },
  9: {
    label: 'Labor Day/秋季开始/万圣节筹备',
    keywords: {
      'labor': 3, 'fall': 4, 'autumn': 3, 'jacket': 3, 'hoodie': 3, 'sweater': 3,
      'boot': 3, 'scarf': 2, 'gloves': 1, 'halloween': 3, 'costume': 3, 'decor': 2,
      'outdoor': 2, 'garden': 2, 'football': 3, 'sport': 2, 'blanket': 2,
      'coffee': 2, 'tea': 2, 'cozy': 2, 'candle': 2, 'home': 2
    }
  },
  10: {
    label: '万圣节/秋季/Columbus Day',
    keywords: {
      'halloween': 5, 'costume': 5, 'pumpkin': 4, 'spooky': 3, 'ghost': 3, 'witch': 3,
      'decor': 3, 'party': 3, 'candy': 2, 'mask': 3, 'makeup': 2,
      'fall': 4, 'autumn': 3, 'jacket': 3, 'hoodie': 3, 'sweater': 3, 'coat': 2,
      'boot': 3, 'scarf': 2, 'football': 2, 'blanket': 2, 'coffee': 2, 'candle': 2,
      'thanksgiving': 1, 'cozy': 2, 'home': 2
    }
  },
  11: {
    label: '感恩节/Black Friday/网购星期一',
    keywords: {
      'thanksgiving': 5, 'turkey': 4, 'gratitude': 3, 'family': 2, 'dinner': 3,
      'black friday': 5, 'cyber': 4, 'deal': 4, 'sale': 3, 'discount': 3,
      'electronic': 4, 'tech': 3, 'gadget': 3, 'gift': 3, 'toy': 4, 'game': 3,
      'winter': 3, 'jacket': 3, 'coat': 3, 'hoodie': 2, 'boot': 3, 'hat': 2,
      'christmas': 3, 'holiday': 3, 'decor': 3, 'cooking': 3, 'kitchen': 2,
      'cozy': 2, 'blanket': 2, 'candle': 2
    }
  },
  12: {
    label: '圣诞节/假日季/年末',
    keywords: {
      'christmas': 5, 'xmas': 4, 'holiday': 4, 'tree': 3, 'ornament': 3, 'light': 2,
      'gift': 5, 'present': 4, 'toy': 5, 'game': 4, 'stocking': 3, 'santa': 3,
      'snow': 3, 'winter': 4, 'jacket': 3, 'coat': 3, 'hoodie': 2, 'gloves': 3,
      'scarf': 3, 'boot': 3, 'hat': 2, 'cozy': 3, 'blanket': 3, 'candle': 2,
      'new year': 3, 'eve': 2, 'party': 3, 'sparkling': 2, 'champagne': 2,
      'baking': 2, 'cookie': 2, 'chocolate': 2, 'skincare': 2, 'beauty': 2,
      'jewelry': 3, 'watch': 2, 'electronic': 3, 'tech': 2, 'fitness': 2
    }
  }
};

/**
 * 计算品牌的推广时效性评分 (0-25)
 */
function scoreSeasonality(brand, details) {
  const month = new Date().getMonth() + 1;
  const seasonal = SEASONAL_MAP[month];
  if (!seasonal) return { score: 13, matchedKeywords: [], seasonLabel: '' };

  const texts = [];
  if (brand.name) texts.push(brand.name.toLowerCase());
  if (brand.bio) texts.push(brand.bio.toLowerCase());
  if (brand.biography) texts.push(brand.biography.toLowerCase());
  if (brand.category) texts.push(brand.category.toLowerCase());
  if (brand.brandOwnerName) texts.push(brand.brandOwnerName.toLowerCase());
  if (brand.description) texts.push(brand.description.toLowerCase());
  if (details?.topCategory) texts.push(details.topCategory.toLowerCase());
  const combinedText = texts.join(' ');

  let rawScore = 0;
  const matchedKeywords = [];

  for (const [keyword, weight] of Object.entries(seasonal.keywords)) {
    if (combinedText.includes(keyword)) {
      rawScore += weight;
      matchedKeywords.push(keyword);
    }
  }

  if (matchedKeywords.length === 0) {
    return { score: 6, matchedKeywords: [], seasonLabel: seasonal.label };
  }

  const score = Math.min(25, 6 + Math.round(rawScore * 1.27));
  return { score, matchedKeywords: matchedKeywords.slice(0, 5), seasonLabel: seasonal.label };
}

/**
 * 调用 Levanta creator v2 products API 获取品牌详情
 * 注意：Levanta 的佣金是小数格式（0.12 = 12%），需要 ×100
 */
async function fetchLevantaBrandDetails(apiKey, brandId) {
  const url = new URL('https://app.levanta.io/api/creator/v2/products');
  url.searchParams.set('brand_ids', brandId);
  url.searchParams.set('marketplace', 'all');
  url.searchParams.set('limit', '100');

  try {
    const response = await axios.get(url.toString(), {
      timeout: TIMEOUT,
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    const products = response.data.products || [];
    if (products.length === 0) return null;

    let totalCommission = 0;
    let totalRating = 0;
    let ratedCount = 0;
    let totalRatings = 0;
    let totalPrice = 0;
    let pricedCount = 0;
    const categories = {};

    for (const p of products) {
      // Levanta 佣金是小数格式：totalCommission: "0.120" = 12%
      const commission = parseFloat(p.commission?.totalCommission || '0') * 100;
      totalCommission += commission;

      if (p.rating && parseFloat(p.rating) > 0) {
        totalRating += parseFloat(p.rating);
        ratedCount++;
      }
      totalRatings += (p.ratingsTotal || 0);

      const price = parseFloat(p.price?.value || '0');
      if (price > 0) {
        totalPrice += price;
        pricedCount++;
      }

      if (p.category) {
        categories[p.category] = (categories[p.category] || 0) + 1;
      }
    }

    const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    return {
      productCount: products.length,
      avgCommission: totalCommission / products.length,
      avgRating: ratedCount > 0 ? totalRating / ratedCount : 0,
      totalRatings,
      avgPrice: pricedCount > 0 ? totalPrice / pricedCount : 0,
      topCategory
    };
  } catch (error) {
    console.error(`Levanta 详情获取失败 (${brandId}): ${error.message}`);
    return null;
  }
}

// 中性基础分：当 API 不提供某维度数据时使用，避免全部归零
const NEUTRAL_SCORE = 13;

/**
 * 核心评分函数：4 维度各 25 分，总分 100
 *
 * 1. 品牌流量 (0-25)：产品数量 + 评价总数
 * 2. 佣金水平 (0-25)：佣金率（百分比）
 * 3. 产品销量 (0-25)：产品数 + 评分 + 价格
 * 4. 推广时效 (0-25)：季节性 + 节假日匹配度
 *
 * 数据来源说明：
 * - Levanta: 有产品详情 API（fetchLevantaBrandDetails），可获取全部维度数据
 * - ArtemisAds: 列表 API 自带 avgCommission + activeProductCount + biography
 * - Wayward: 列表 API 自带 avg_commission + active_products_count
 * - PartnerBoost: 列表 API 不提供佣金/产品数据，仅 id/name/url/country
 */
function scoreBrand(brand, platform, details) {
  const d = details || {};
  const scores = { traffic: 0, commission: 0, sales: 0, seasonality: 0 };
  const sources = {};
  // 标记各维度是否有数据来源
  const hasData = { traffic: false, commission: false, sales: false };

  // === 维度1: 品牌流量 (0-25) ===
  // 统一从各平台获取产品数
  const productCount = d.productCount
    ?? brand.activeProductCount
    ?? brand.active_products_count
    ?? brand.product_count
    ?? 0;
  const totalRatings = d.totalRatings ?? 0;
  sources.productCount = productCount;

  if (productCount > 0 || totalRatings > 0) {
    hasData.traffic = true;
    // 产品数：至少1分起（避免小数产品数得0分）
    const productScore = productCount > 0 ? Math.max(1, Math.min(15, Math.round(productCount / 13))) : 0;
    const ratingScore = Math.min(10, Math.round(totalRatings / 100));
    scores.traffic = productScore + ratingScore;
  }
  sources.totalRatings = totalRatings;

  // === 维度2: 佣金水平 (0-25) ===
  let commissionRate = 0;
  if (d.avgCommission !== undefined && d.avgCommission > 0) {
    // Levanta details（已×100，是百分比）
    commissionRate = d.avgCommission;
    sources.commissionSource = 'Levanta产品API';
    hasData.commission = true;
  } else if (brand.avgCommission > 0) {
    // ArtemisAds（百分比格式，如 10, 15, 24.3）
    commissionRate = brand.avgCommission;
    sources.commissionSource = 'ArtemisAds';
    hasData.commission = true;
  } else if (brand.avg_commission > 0) {
    // Wayward（百分比格式）
    commissionRate = brand.avg_commission;
    sources.commissionSource = 'Wayward';
    hasData.commission = true;
  } else if (brand.commission_rate) {
    // PartnerBoost 或其他（可能带%号）
    const parsed = parseFloat(brand.commission_rate);
    if (parsed > 0) {
      commissionRate = parsed;
      sources.commissionSource = '平台数据';
      hasData.commission = true;
    }
  }
  // 佣金率百分比映射（10% → 13分，20%+ → 25分）
  scores.commission = Math.min(25, Math.round(commissionRate * 1.25));
  sources.commissionRate = commissionRate;

  // === 维度3: 产品销量 (0-25) ===
  const avgRating = d.avgRating ?? 0;
  const avgPrice = d.avgPrice ?? 0;
  if (productCount > 0 || avgRating > 0 || avgPrice > 0) {
    hasData.sales = true;
    // 产品数：至少1分起
    const productScore = productCount > 0 ? Math.max(1, Math.min(10, Math.round(productCount / 10))) : 0;
    const ratingScore = Math.min(8, Math.round(avgRating * 1.6));
    const priceScore = Math.min(7, Math.round(avgPrice / 15));
    scores.sales = productScore + ratingScore + priceScore;
  }
  sources.avgRating = avgRating;
  sources.avgPrice = avgPrice;

  // 对于无数据来源的维度，给中性分（NEUTRAL_SCORE=13），避免全部归零
  if (!hasData.traffic) scores.traffic = NEUTRAL_SCORE;
  if (!hasData.commission) scores.commission = NEUTRAL_SCORE;
  if (!hasData.sales) scores.sales = NEUTRAL_SCORE;

  // === 维度4: 推广时效性 (0-25) ===
  const seasonResult = scoreSeasonality(brand, d);
  scores.seasonality = seasonResult.score;
  sources.seasonLabel = seasonResult.seasonLabel;
  sources.matchedKeywords = seasonResult.matchedKeywords;

  const total = scores.traffic + scores.commission + scores.sales + scores.seasonality;

  return {
    total,
    scores,
    sources,
    grade: total >= 80 ? 'A' : total >= 60 ? 'B' : total >= 40 ? 'C' : 'D'
  };
}

/**
 * 对一个平台的所有新增品牌批量评分
 */
async function scoreNewBrands(newBrands, platform, apiKey) {
  if (!newBrands || newBrands.length === 0) return [];

  const results = [];

  for (const brand of newBrands) {
    let details = null;

    if (platform === 'levanta' && apiKey) {
      details = await fetchLevantaBrandDetails(apiKey, brand.id);
    }

    const scoreResult = scoreBrand(brand, platform, details);
    results.push({ brand, ...scoreResult });
  }

  results.sort((a, b) => b.total - a.total);
  return results;
}

module.exports = { scoreNewBrands, scoreBrand, fetchLevantaBrandDetails, scoreSeasonality, SEASONAL_MAP };
