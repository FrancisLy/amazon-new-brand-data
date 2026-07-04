const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const MAX_HISTORY_DAYS = 7;

function getDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayDate() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getDateString(yesterday);
}

function getFilePath(platform, date) {
  return path.join(DATA_DIR, `${platform}_${date}.json`);
}

async function saveBrands(platform, brands, date = new Date()) {
  const dateStr = getDateString(date);
  const filePath = getFilePath(platform, dateStr);

  await fs.promises.mkdir(DATA_DIR, { recursive: true });

  const data = {
    date: dateStr,
    timestamp: new Date().toISOString(),
    brands: brands
  };

  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`${platform}: 数据已保存到 ${filePath}`);
}

async function loadBrands(platform, dateStr) {
  const filePath = getFilePath(platform, dateStr);
  
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    return data.brands || [];
  } catch (error) {
    console.log(`${platform}: 未找到 ${dateStr} 的数据文件`);
    return [];
  }
}

function compareBrands(todayBrands, yesterdayBrands) {
  const todayMap = new Map(todayBrands.map(b => [b.id, b]));
  const yesterdayMap = new Map(yesterdayBrands.map(b => [b.id, b]));
  
  const newBrands = todayBrands.filter(b => !yesterdayMap.has(b.id));
  const removedBrands = yesterdayBrands.filter(b => !todayMap.has(b.id));
  
  return {
    new: newBrands,
    removed: removedBrands,
    totalToday: todayBrands.length,
    totalYesterday: yesterdayBrands.length
  };
}

// 清理超过 MAX_HISTORY_DAYS 天的历史数据文件
async function cleanupOldHistory(days = MAX_HISTORY_DAYS) {
  try {
    const files = await fs.promises.readdir(DATA_DIR);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = getDateString(cutoff);

    let deleted = 0;
    for (const file of files) {
      // 匹配形如 platform_YYYY-MM-DD.json
      const match = file.match(/_(\d{4}-\d{2}-\d{2})\.json$/);
      if (!match) continue;
      const fileDate = match[1];
      if (fileDate < cutoffStr) {
        await fs.promises.unlink(path.join(DATA_DIR, file));
        deleted++;
      }
    }
    if (deleted > 0) {
      console.log(`已清理 ${deleted} 个超过 ${days} 天的历史数据文件`);
    }
  } catch (error) {
    console.error('清理历史数据失败:', error.message);
  }
}

module.exports = {
  getDateString,
  getYesterdayDate,
  saveBrands,
  loadBrands,
  compareBrands,
  cleanupOldHistory
};
