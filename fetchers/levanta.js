const axios = require('axios');

const TIMEOUT = 30000;
const MAX_RETRIES = 3;

async function fetchLevantaBrands(apiKey) {
  const brands = [];
  let cursor = null;
  const limit = 100;

  const axiosInstance = axios.create({
    timeout: TIMEOUT,
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });

  async function fetchWithRetry(url, retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await axiosInstance.get(url);
      } catch (error) {
        if (attempt === retries) throw error;
        console.log(`Levanta: 第${attempt}次重试 (${error.message})`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  try {
    while (true) {
      const url = new URL('https://app.levanta.io/api/creator/v1/brands');
      url.searchParams.set('limit', limit);
      if (cursor) {
        url.searchParams.set('cursor', cursor);
      }

      const response = await fetchWithRetry(url.toString());
      const data = response.data;

      if (data.brands && data.brands.length > 0) {
        brands.push(...data.brands.map(b => ({
          id: b.brandId,
          name: b.brandName,
          url: b.url
        })));
      }

      cursor = data.cursor;
      if (!cursor) {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }
    console.log(`Levanta: 获取到 ${brands.length} 个商家`);
    return brands;
  } catch (error) {
    console.error('Levanta API请求失败:', error.message);
    // 返回已获取的部分数据，避免整体失败
    if (brands.length > 0) {
      console.log(`Levanta: 返回已获取的 ${brands.length} 个商家（部分数据）`);
      return brands;
    }
    throw error;
  }
}

module.exports = { fetchLevantaBrands };
