const axios = require('axios');

const TIMEOUT = 30000;
const MAX_RETRIES = 3;
// 文档枚举的全部 marketplace
const MARKETPLACES = ['amazon.com', 'amazon.co.uk', 'amazon.ca', 'amazon.de', 'amazon.fr'];

async function fetchArtemisAdsBrands(apiKey) {
  if (!apiKey) {
    throw new Error('ARTEMISADS_API_KEY 未配置');
  }

  const axiosInstance = axios.create({
    timeout: TIMEOUT,
    headers: {
      // 注意：ArtemisAds 用自定义 header，不是标准的 Authorization
      'x-aa-authorization': `Bearer ${apiKey}`
    }
  });

  async function fetchWithRetry(url, retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await axiosInstance.get(url);
      } catch (error) {
        if (attempt === retries) throw error;
        console.log(`ArtemisAds: 第${attempt}次重试 (${error.message})`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  // 抓取单个 marketplace 的全部品牌（游标分页）
  async function fetchMarketplace(marketplace) {
    const brands = [];
    let cursor = null;
    const limit = 100;

    while (true) {
      const url = new URL('https://api.artemisads.com/openapi/publisher/v1/brands');
      url.searchParams.set('marketplace', marketplace);
      url.searchParams.set('limit', limit);
      if (cursor) {
        url.searchParams.set('cursor', cursor);
      }

      const response = await fetchWithRetry(url.toString());
      const data = response.data || {};

      if (Array.isArray(data.brands) && data.brands.length > 0) {
        for (const b of data.brands) {
          brands.push({
            // 跨 marketplace 合并时用 marketplace:brandId 保证唯一
            id: `${marketplace}:${b.brandId}`,
            name: `${b.brandName} [${marketplace}]`,
            url: b.url || ''
          });
        }
      }

      cursor = data.cursor;
      if (!cursor) break;

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    return brands;
  }

  const allBrands = [];

  try {
    for (const mp of MARKETPLACES) {
      try {
        const mpBrands = await fetchMarketplace(mp);
        console.log(`ArtemisAds [${mp}]: 获取到 ${mpBrands.length} 个商家`);
        allBrands.push(...mpBrands);
      } catch (error) {
        // 单个 marketplace 失败不影响其它，继续抓
        console.error(`ArtemisAds [${mp}] 抓取失败: ${error.message}`);
      }
    }

    console.log(`ArtemisAds: 共获取到 ${allBrands.length} 个商家（跨 ${MARKETPLACES.length} 个 marketplace）`);
    return allBrands;
  } catch (error) {
    console.error('ArtemisAds API请求失败:', error.message);
    if (allBrands.length > 0) {
      console.log(`ArtemisAds: 返回已获取的 ${allBrands.length} 个商家（部分数据）`);
      return allBrands;
    }
    throw error;
  }
}

module.exports = { fetchArtemisAdsBrands };
