'use strict';

/** Express router providing API V1 routes
 * @module routers/v1
 * @requires express
 */
const express = require('express');

/**
 * Express router to mount APIs on.
 * @type {Object}
 * @const
 * @namespace v1Router
 */
const router = express.Router();

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/enhanced_bangumi_api',
});

const fetch = require('node-fetch');

const VERSION = 'v1';

/* Routes */
/**
 * Route getting all subjects.
 * @name get/subjects
 * @function
 * @memberof module:routers/v1~v1Router
 * @inner
 * @param {string} path Express path.
 * @param {callback} middleware Express callback middleware.
 */
router.get('/subjects', async (req, res, next) => {
  const results = await pool.query('SELECT * FROM subjects ORDER BY on_air_date ASC');
  if (!results.rowCount) {
    next();
    return;
  }
  results.rows.forEach((subject) => {
    collateSubject(subject);
    subject['api_ref'] = `/${VERSION}/subjects/${subject['id']}`;
  });
  await res.json(results.rows);
});

/**
 * Route getting the subject by subject ID.
 * @name get/subjects/subjectId
 * @function
 * @memberof module:routers/v1~v1Router
 * @inner
 * @param {string} path Express path.
 * @param {callback} middleware Express callback middleware.
 */
router.get('/subjects/:subjectId', async (req, res, next) => {
  const subjectId = parseInt(req.params.subjectId);
  let results = await pool.query('SELECT * FROM subjects WHERE id = $1', [subjectId]);
  if (results.rowCount !== 1) {
    next();
    return;
  }
  let subject = results.rows[0];
  collateSubject(subject);
  // Get sources and episodes from database and Bangumi
  let [additional, episodes, sources] = await Promise.all([
    getSubjectByIdFromBangumi(subjectId),
    getEpisodesBySubjectId(subjectId),
    getSubjectSourcesBySubjectId(subjectId),
  ]);
  additional['eps'].forEach((ep) => ep['sources'] = []);
  subject = {
    ...subject,
    ...additional,
    sources: sources
  };
  // Construct inverse indices for quick lookup
  let inverseIndexSources = {};
  for (let [index, source] of sources.entries()) {
    inverseIndexSources[source['service_id']] = index;
  }
  let inverseIndexEpisodes = {};
  for (let [index, episode] of subject['eps'].entries()) {
    inverseIndexEpisodes[episode['id']] = index;
  }
  // Associate each episode with its episode sources
  episodes.forEach((episodeSource) => {
    const sourceIndex = inverseIndexSources[episodeSource['service_id']];
    const source = subject['sources'][sourceIndex];
    const episodeIndex = inverseIndexEpisodes[episodeSource['episode_id']];
    const ep = subject['eps'][episodeIndex];
    ep['sources'].push(episodeSource);
    // Manually collate episode sources (similar to collateEpisodeSource function)
    episodeSource['episode_url'] = generateEpisodeUrl(source['episode_url_format'], episodeSource['episode_url_id'], source['subject_url_id']);
    episodeSource['video_url'] = generateVideoUrl(source['video_url_format'], episodeSource['video_url_id']);
    episodeSource['api_ref'] = `/${VERSION}/subjects/${subjectId}/eps/${ep['id']}/sources/${source['service_id']}`;
    multiDeleteAttrs(episodeSource, ['episode_id', 'episode_url_id', 'video_url_id']);
  });
  // Clean-up
  sources.forEach((source) => collateSubjectSource(source));
  await res.json(subject);
});

/**
 * Route getting all episodes by subject ID. This API returns exactly the same response as the previous one.
 * @name get/subjects/subjectId/eps
 * @function
 * @memberof module:routers/v1~v1Router
 * @inner
 * @param {string} path Express path.
 * @param {callback} middleware Express callback middleware.
 */
router.get('/subjects/:subjectId/eps', (req, res, next) => {
  const subjectId = parseInt(req.params.subjectId);
  // Redirect to the previous API without changing the URL
  req.url = `/subjects/${subjectId}`;
  router.handle(req, res, next);
});

/**
 * Route getting the episode by subject ID and episode ID.
 * @name get/subjects/subjectId/eps/episodeId
 * @function
 * @memberof module:routers/v1~v1Router
 * @inner
 * @param {string} path Express path.
 * @param {callback} middleware Express callback middleware.
 */
router.get('/subjects/:subjectId/eps/:episodeId', async (req, res, next) => {
  const subjectId = parseInt(req.params.subjectId);
  // Check the existence of subject ID
  let results = await pool.query('SELECT * FROM subjects WHERE id = $1', [subjectId]);
  if (results.rowCount !== 1) {
    next();
    return;
  }
  // Get sources and episodes from database and Bangumi
  const episodeId = parseInt(req.params.episodeId);
  let [additional, episodeSources] = await Promise.all([
    getSubjectByIdFromBangumi(subjectId),
    getEpisodeSourcesBySubjectIdAndEpisodeId(subjectId, episodeId),
  ]);
  // Find that certain episode
  let episode = null;
  for (let i = 0; i < additional['eps'].length; i++) {
    if (additional['eps'][i]['id'] === episodeId) {
      episode = additional['eps'][i];
      break;
    }
  }
  if (!episode) {
    next();
    return;
  }
  // Associate that episode with its episode sources and clean-up
  episode['sources'] = episodeSources;
  delete episode['api_ref'];
  await res.json(episode);
});

/**
 * Route getting all episode sources by subject ID and episode ID.
 * @name get/subjects/subjectId/eps/episodeId/sources
 * @function
 * @memberof module:routers/v1~v1Router
 * @inner
 * @param {string} path Express path.
 * @param {callback} middleware Express callback middleware.
 */
router.get('/subjects/:subjectId/eps/:episodeId/sources', async (req, res, next) => {
  const subjectId = parseInt(req.params.subjectId);
  const episodeId = parseInt(req.params.episodeId);
  const sources = await getEpisodeSourcesBySubjectIdAndEpisodeId(subjectId, episodeId);
  if (!sources || !sources.length) {
    next();
    return;
  }
  await res.json(sources);
});

/**
 * Route getting the episode source by subject ID, episode ID and service ID.
 * @name get/subjects/subjectId/eps/episodeId/sources/serviceId
 * @function
 * @memberof module:routers/v1~v1Router
 * @inner
 * @param {string} path Express path.
 * @param {callback} middleware Express callback middleware.
 */
router.get('/subjects/:subjectId/eps/:episodeId/sources/:serviceId', async (req, res, next) => {
  const subjectId = parseInt(req.params.subjectId);
  const episodeId = parseInt(req.params.episodeId);
  const serviceId = req.params.serviceId;
  const results = await pool.query('SELECT sources.service_id, localized_name, authorized, paid, subject_url_id, episode_url_format, episode_url_id, video_url_format, video_url_id, subtitle_locales FROM sources JOIN services ON sources.service_id = services.id JOIN episodes ON sources.service_id = episodes.service_id WHERE sources.subject_id = $1 AND episode_id = $2 AND sources.service_id = $3', [subjectId, episodeId, serviceId]);
  if (results.rowCount !== 1) {
    next();
    return;
  }
  collateEpisodeSource(results.rows[0]);
  await res.json(results.rows[0]);
});

/**
 * Route getting all subject sources by subject ID.
 * @name get/subjects/subjectId/sources
 * @function
 * @memberof module:routers/v1~v1Router
 * @inner
 * @param {string} path Express path.
 * @param {callback} middleware Express callback middleware.
 */
router.get('/subjects/:subjectId/sources', async (req, res, next) => {
  const subjectId = parseInt(req.params.subjectId);
  const sources = await getSubjectSourcesBySubjectId(subjectId);
  if (!sources || !sources.length) {
    next();
    return;
  }
  sources.forEach((source) => collateSubjectSource(source));
  await res.json(sources);
});

/**
 * Route getting the subject source by subject ID and service ID.
 * @name get/subjects/subjectId/sources/serviceId
 * @function
 * @memberof module:routers/v1~v1Router
 * @inner
 * @param {string} path Express path.
 * @param {callback} middleware Express callback middleware.
 */
router.get('/subjects/:subjectId/sources/:serviceId', async (req, res, next) => {
  const subjectId = parseInt(req.params.subjectId);
  const serviceId = req.params.serviceId;
  const results = await pool.query('SELECT service_id, localized_name, authorized, paid, subject_url_format, subject_url_id, subtitle_locales FROM sources JOIN services ON sources.service_id = services.id WHERE subject_id = $1 AND service_id = $2', [subjectId, serviceId]);
  if (results.rowCount !== 1) {
    next();
    return;
  }
  collateSubjectSource(results.rows[0]);
  await res.json(results.rows[0]);
});

module.exports = router;

/* Functions */
/**
 * Delete multiple attributes from an object.
 * @function multiDeleteAttrs
 * @param {Object} obj An object.
 * @param {string[]} attrs An array of attribute strings.
 */
const multiDeleteAttrs = (obj, attrs) => {
  attrs.forEach((attr) => {
    if (attr in obj) {
      delete obj[attr];
    }
  });
};

/**
 * Get additional subject information by subject ID from Bangumi API.
 * @async
 * @function getSubjectByIdFromBangumi
 * @param {number} subjectId Subject ID.
 * @return {Object} An object with "summary" and "eps" fields.
 */
const getSubjectByIdFromBangumi = async (subjectId) => {
  const response = await fetch(`https://api.bgm.tv/subject/${subjectId}?responseGroup=large`);
  const results = response && (await response.json());
  results.eps.forEach((ep) => {
    ep['api_ref'] = `/${VERSION}/subjects/${subjectId}/eps/${ep['id']}`;
    multiDeleteAttrs(ep, ['comment', 'url']);
  });
  return {
    summary: results.summary,
    eps: results.eps,
  };
};

/**
 * Get all subject sources by subject ID from database.
 * @async
 * @function getSubjectSourcesBySubjectId
 * @param {number} subjectId Subject ID.
 * @return {Object[]} An array of all subject sources.
 */
const getSubjectSourcesBySubjectId = async (subjectId) => {
  const results = await pool.query('SELECT service_id, localized_name, authorized, paid, subject_url_format, subject_url_id, episode_url_format, video_url_format, subtitle_locales FROM sources JOIN services ON sources.service_id = services.id WHERE subject_id = $1', [subjectId]);
  results.rows.forEach((source) => source['api_ref'] = `/${VERSION}/subjects/${subjectId}/sources/${source['service_id']}`);
  return results.rows;
};

/**
 * Get all episodes by subject ID from database.
 * @async
 * @function getEpisodesBySubjectId
 * @param {number} subjectId Subject ID.
 * @return {Object[]} An array of all episodes.
 */
const getEpisodesBySubjectId = async (subjectId) => (await pool.query('SELECT episode_id, service_id, episode_url_id, video_url_id FROM episodes WHERE subject_id = $1', [subjectId])).rows;

/**
 * Get all episode sources by subject ID and episode ID from database.
 * @async
 * @function getEpisodeSourcesBySubjectIdAndEpisodeId
 * @param {number} subjectId Subject ID.
 * @param {number} episodeId Episode ID.
 * @return {Object[]} An array of all episode sources.
 */
const getEpisodeSourcesBySubjectIdAndEpisodeId = async (subjectId, episodeId) => {
  const results = await pool.query('SELECT sources.service_id, localized_name, authorized, paid, subject_url_id, episode_url_format, episode_url_id, video_url_format, video_url_id, subtitle_locales FROM sources JOIN services ON sources.service_id = services.id JOIN episodes ON sources.service_id = episodes.service_id WHERE sources.subject_id = $1 AND episode_id = $2', [subjectId, episodeId]);
  results.rows.forEach((source) => {
    collateEpisodeSource(source);
    source['api_ref'] = `/${VERSION}/subjects/${subjectId}/eps/${episodeId}/sources/${source['service_id']}`;
  });
  return results.rows;
};

/**
 * Generate subject URL from the pattern.
 * @function generateSubjectUrl
 * @param {string|null} subjectUrlFormat The pattern of subject URL.
 * @param {string|null} subjectUrlId Unique subject URL identifier.
 * @return {string|null} The complete subject URL.
 */
const generateSubjectUrl = (subjectUrlFormat, subjectUrlId) => {
  if (subjectUrlFormat && subjectUrlId) {
    return subjectUrlFormat.replace('%s', subjectUrlId);
  } else if (subjectUrlFormat && !subjectUrlFormat.includes('%s')) {
    return subjectUrlFormat;
  } else {
    return null;
  }
};

/**
 * Generate episode URL from the pattern.
 * @function generateEpisodeUrl
 * @param {string|null} episodeUrlFormat The pattern of episode URL.
 * @param {string|null} episodeUrlId Unique episode URL identifier.
 * @param {string|null} subjectUrlId Unique subject URL identifier.
 * @return {string|null} The complete episode URL.
 */
const generateEpisodeUrl = (episodeUrlFormat, episodeUrlId, subjectUrlId) => {
  let episodeUrl = null;
  if (episodeUrlFormat) {
    episodeUrl = episodeUrlFormat;
    if (episodeUrlId && episodeUrlFormat.includes('%e')) {
      episodeUrl = episodeUrl.replace('%e', episodeUrlId);
    }
    if (subjectUrlId && episodeUrlFormat.includes('%s')) {
      episodeUrl = episodeUrl.replace('%s', subjectUrlId);
    }
  }
  return episodeUrl;
};

/**
 * Generate video URL from the pattern.
 * @function generateVideoUrl
 * @param {string|null} videoUrlFormat The pattern of video URL.
 * @param {string|null} videoUrlId Unique video URL identifier.
 * @return {string|null} The complete video URL.
 */
const generateVideoUrl = (videoUrlFormat, videoUrlId) => {
  if (videoUrlFormat && videoUrlId) {
    return videoUrlFormat.replace('%s', videoUrlId);
  } else if (videoUrlFormat && !videoUrlFormat.includes('%s')) {
    return videoUrlFormat;
  } else {
    return null;
  }
};

/**
 * Split a subtitle locales string into an array.
 * @function splitSubtitleLocales
 * @param {string|null} subtitleLocalesString A colon-separated subtitle locales string.
 * @return {string[]} An array of all locales.
 */
const splitSubtitleLocales = (subtitleLocalesString) => {
  subtitleLocalesString = subtitleLocalesString === null ? '' : subtitleLocalesString;
  return subtitleLocalesString.split(':');
};

/**
 * Collate a subject.
 * @function collateSubject
 * @param {Object} subject A subject object.
 */
const collateSubject = (subject) => {
  subject['bgm_url'] = `https://bgm.tv/subject/${subject['id']}`;
  subject['mal_url'] = subject['mal_id'] ? `https://myanimelist.net/anime/${subject['mal_id']}` : null;
  subject['bgm_image_url'] = subject['bgm_image_url'] ? `https://lain.bgm.tv/pic/cover/c/${subject['bgm_image_url']}.jpg` : null;
  delete subject['mal_id'];
};

/**
 * Collate a subject source.
 * @function collateSubjectSource
 * @param {Object} source A source object.
 */
const collateSubjectSource = (source) => {
  source['subject_url'] = generateSubjectUrl(source['subject_url_format'], source['subject_url_id']);
  source['subtitle_locales'] = splitSubtitleLocales(source['subtitle_locales']);
  multiDeleteAttrs(source, ['subject_id', 'subject_url_format', 'subject_url_id', 'episode_url_format', 'video_url_format']);
};

/**
 * Collate an episode source.
 * @function collateSubjectSource
 * @param {Object} source A source object.
 */
const collateEpisodeSource = (source) => {
  source['episode_url'] = generateEpisodeUrl(source['episode_url_format'], source['episode_url_id'], source['subject_url_id']);
  source['video_url'] = generateVideoUrl(source['video_url_format'], source['video_url_id']);
  source['subtitle_locales'] = splitSubtitleLocales(source['subtitle_locales']);
  multiDeleteAttrs(source, ['subject_url_id', 'episode_url_format', 'episode_url_id', 'video_url_format', 'video_url_id']);
};
