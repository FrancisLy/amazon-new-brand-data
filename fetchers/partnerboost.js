const axios = require('axios');

const TIMEOUT = 30000;
const MAX_RETRIES = 3;

async function fetchPartnerBoostBrands(apiKey) {
  const brands = [];
  let page = 1;
  const pageSize = 20;

  const axiosInstance = axios.create({
    timeout: TIMEOUT
  });

  async function fetchWithRetry(payload, retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await axiosInstance.post(
          'https://app.partnerboost.com/api/datafeed/get_amazon_joined_brands',
          payload
        );
      } catch (error) {
        if (attempt === retries) throw error;
        console.log(`PartnerBoost: 第${attempt}次重试 (${error.message})`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  try {
    while (true) {
      const response = await fetchWithRetry({
        token: apiKey,
        page_size: pageSize,
        page: page
      });

      const data = response.data;
      if (!data || !data.data || !data.data.list || data.data.list.length === 0) {
        break;
      }

      brands.push(...data.data.list.map(b => ({
        id: b.bid,
        name: b.brand_name,
        url: b.amazon_store_url || ''
      })));

      if (!data.data.hasMore) {
        break;
      }
      page++;

      await new Promise(resolve => setTimeout(resolve, 300));
    }
    console.log(`PartnerBoost: 获取到 ${brands.length} 个商家`);
    return brands;
  } catch (error) {
    console.error('PartnerBoost API请求失败:', error.message);
    // 返回已获取的部分数据，避免整体失败
    if (brands.length > 0) {
      console.log(`PartnerBoost: 返回已获取的 ${brands.length} 个商家（部分数据）`);
      return brands;
    }
    throw error;
  }
}

module.exports = { fetchPartnerBoostBrands };
