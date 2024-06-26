const _ = require('lodash');

/**
 * Formats the number into "human readable" number/
 *
 * @param {Number} num The number to format.
 * @returns {string} The number as a string or error text if we couldn't
 *   format it.
 */
function formatBytes(num) {
  if (!Number.isFinite(num)) {
    return 'Could not retrieve value';
  }

  const UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];

  const neg = num < 0;
  if (neg) num = -num;

  if (num < 1) {
    return (neg ? '-' : '') + num + ' B';
  }

  const exponent = Math.min(
    Math.floor(Math.log(num) / Math.log(1024)),
    UNITS.length - 1
  );
  const numStr = Number((num / Math.pow(1024, exponent)).toPrecision(3));
  const unit = UNITS[exponent];

  return (neg ? '-' : '') + numStr + ' ' + unit;
}

function parseRedisServerInfo(redisServerInfo) {
  if (typeof redisServerInfo !== 'string') {
    return {};
  }

  const serverInfo = {};
  redisServerInfo
    .split('\r\n')
    .map((line) => line.trim())
    .filter((line) => !!line && !line.startsWith('#')) // remove comments and empty lines
    .forEach((line) => {
      const idx = line.indexOf(':');
      if (idx > 0) {
        serverInfo[line.substring(0, idx)] = line.substring(idx + 1);
      }
    });
  return serverInfo;
}

const Helpers = {
  getStats: async function (queue) {
    const client = await queue.client;
    const info = await client.info();

    const stats = _.pickBy(parseRedisServerInfo(info), (value, key) =>
      _.includes(this._usefulMetrics, key)
    );
    stats.used_memory = formatBytes(parseInt(stats.used_memory, 10));
    stats.total_system_memory = formatBytes(
      parseInt(stats.total_system_memory, 10)
    );
    return stats;
  },

  /**
   * This function grabs all the jobs within all groups that are in the specified states
   * passed in
   * @param {Queue} queue
   * @param {Array} stateTypes
   * @returns {Array}
   */
  getGroupJobs: async function (queue, stateTypes) {
    try {
      const groups = await queue.getGroups();
      let groupJobs = [];
      for (const group of groups) {
        if (!group) continue;
        const currentGroupJobs = await queue.getGroupJobs(group.id);
        for (const job of currentGroupJobs) {
          const jobState = await job.getState();
          if (stateTypes.includes(jobState)) {
            groupJobs.push(job);
          }
        }
      }
      return groupJobs;
    } catch (error) {
      console.error('An error occurred:', error);
      return [];
    }
  },

  isPaused: async function (queue) {
    return queue.isPaused();
  },

  _usefulMetrics: [
    'redis_version',
    'total_system_memory',
    'used_memory',
    'mem_fragmentation_ratio',
    'connected_clients',
    'blocked_clients',
  ],

  /**
   * Valid states for a job in bee queue
   */
  BEE_STATES: ['waiting', 'active', 'succeeded', 'failed', 'delayed'],

  /**
   * Valid states for a job in bull queue
   */
  BULL_STATES: [
    'waiting',
    'active',
    'completed',
    'failed',
    'delayed',
    'paused',
  ],

  /**
   * Valid states for a job in bullmq queue
   */
  BULLMQ_STATES: [
    'waiting',
    'prioritized',
    'active',
    'completed',
    'failed',
    'delayed',
    'paused',
    'waiting-children',
  ],
};

module.exports = Helpers;
