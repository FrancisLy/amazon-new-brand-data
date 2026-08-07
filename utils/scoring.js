const axios = require('axios');

const TIMEOUT = 15000;

/**
 * 调用 Levanta creator v2 products API，获取指定品牌的商品详情
 * 返回：{ productCount, avgCommission, avgRating, totalRatings, avgPrice, topCategory }
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
      // 佣金
      const commission = parseFloat(p.commission?.totalCommission || '0');
      totalCommission += commission;

      // 评分
      if (p.rating && parseFloat(p.rating) > 0) {
        totalRating += parseFloat(p.rating);
        ratedCount++;
      }
      totalRatings += (p.ratingsTotal || 0);

      // 价格
      const price = parseFloat(p.price?.value || '0');
      if (price > 0) {
        totalPrice += price;
        pricedCount++;
      }

      // 类目统计
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

/**
 * 对单个新增品牌打分
 * 四个维度各 25 分，总分 100
 *
 * 1. 品牌流量 (0-25)：产品数量 + 评价总数
 * 2. 佣金水平 (0-25)：佣金率
 * 3. 产品销量 (0-25)：产品数 + 评价数 + 价格
 * 4. 亚马逊权重 (0-25)：评分 + 店铺 URL 质量
 */
function scoreBrand(brand, platform, details) {
  const d = details || {};
  const scores = { traffic: 0, commission: 0, sales: 0, ranking: 0 };
  const sources = {};

  // === 维度1: 品牌流量 (0-25) ===
  const productCount = d.productCount ?? brand.activeProductCount ?? brand.product_count ?? 0;
  const totalRatings = d.totalRatings ?? 0;
  sources.productCount = productCount;
  // 产品数 0-200+ 映射到 0-15 分；评价总数 0-1000+ 映射到 0-10 分
  scores.traffic = Math.min(15, Math.round(productCount / 13)) +
                   Math.min(10, Math.round(totalRatings / 100));
  sources.totalRatings = totalRatings;

  // === 维度2: 佣金水平 (0-25) ===
  let commissionRate = 0;
  if (d.avgCommission !== undefined) {
    commissionRate = d.avgCommission;
    sources.commissionSource = 'Levanta产品API';
  } else if (brand.avgCommission) {
    commissionRate = brand.avgCommission;
    sources.commissionSource = 'ArtemisAds';
  } else if (brand.commission_rate) {
    commissionRate = parseFloat(brand.commission_rate) || 0;
    sources.commissionSource = '平台数据';
  }
  // 佣金率 0-25%+ 映射到 0-25 分
  scores.commission = Math.min(25, Math.round(commissionRate * 1.2));
  sources.commissionRate = commissionRate;

  // === 维度3: 产品销量 (0-25) ===
  const avgRating = d.avgRating ?? 0;
  const avgPrice = d.avgPrice ?? 0;
  // 产品数 0-100+ 映射到 0-10 分；评分 0-5 映射到 0-8 分；价格 0-$100+ 映射到 0-7 分
  scores.sales = Math.min(10, Math.round(productCount / 10)) +
                 Math.min(8, Math.round(avgRating * 1.6)) +
                 Math.min(7, Math.round(avgPrice / 15));
  sources.avgRating = avgRating;
  sources.avgPrice = avgPrice;

  // === 维度4: 亚马逊排名/权重 (0-25) ===
  const url = brand.url || '';
  let urlScore = 5;
  if (url.includes('/stores/')) urlScore = 15;       // 正规品牌店铺
  else if (url.includes('/stores') && url.includes('page/')) urlScore = 18; // 完整店铺页
  else if (url.includes('/s?me=')) urlScore = 10;     // 卖家搜索页
  else if (url.includes('amazon.com') || url.includes('amazon.co')) urlScore = 8;
  if (!url) urlScore = 3;

  // 评分加成 0-10 分
  const ratingBoost = Math.min(10, Math.round(avgRating * 2));
  scores.ranking = Math.min(25, urlScore + ratingBoost);
  sources.urlScore = urlScore;
  sources.storefrontUrl = url ? '有' : '无';

  const total = scores.traffic + scores.commission + scores.sales + scores.ranking;

  return {
    total,
    scores,
    sources,
    grade: total >= 80 ? 'A' : total >= 60 ? 'B' : total >= 40 ? 'C' : 'D'
  };
}

/**
 * 对一个平台的所有新增品牌批量评分
 * newBrands: 新增品牌数组
 * 返回带评分的数组（按总分降序）
 */
async function scoreNewBrands(newBrands, platform, apiKey) {
  if (!newBrands || newBrands.length === 0) return [];

  const results = [];

  for (const brand of newBrands) {
    let details = null;

    // Levanta: 调用产品 API 获取详情
    if (platform === 'levanta' && apiKey) {
      details = await fetchLevantaBrandDetails(apiKey, brand.id);
    }

    // ArtemisAds: 数据已在 brand 对象中
    // 其他平台: 使用 brand 对象中已有的字段

    const scoreResult = scoreBrand(brand, platform, details);
    results.push({ brand, ...scoreResult });
  }

  // 按总分降序排列
  results.sort((a, b) => b.total - a.total);
  return results;
}

module.exports = { scoreNewBrands, scoreBrand, fetchLevantaBrandDetails };
