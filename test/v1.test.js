'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
chai.use(chaiHttp);
const expect = chai.expect;
const app = require('../app');
const request = require('supertest');

/* Functions */
/**
 * Test a generic source object.
 * @function expectAGenericSourceObject
 * @param {Object} source A generic source object.
 */
const expectAGenericSourceObject = (source) => {
  expect(source).to.be.a('object');
  expect(source).to.have.property('service_id').which.is.a('string');
  expect(source).to.have.property('localized_name').which.is.a('string');
  expect(source).to.have.property('authorized').which.is.a('boolean');
  expect(source).to.have.property('paid').which.is.a('number').and.satisfy(Number.isInteger);
  expect(source).to.have.property('subtitle_locales');
};

/**
 * Test a generic episode object.
 * @function expectAGenericEpisodeObject
 * @param {Object} episode A generic episode object.
 */
const expectAGenericEpisodeObject = (episode) => {
  expect(episode).to.be.a('object');
  expect(episode).to.have.property('id').which.is.a('number').and.satisfy(Number.isInteger);
  expect(episode).to.have.property('type').which.is.a('number').and.satisfy(Number.isInteger);
  expect(episode).to.have.property('airdate');
  expect(episode).to.have.property('sources').which.is.a('array');
  episode.sources.forEach((source) => {
    expect(source).to.be.a('object');
    expect(source).to.have.property('service_id').which.is.a('string');
    expect(source).to.have.property('episode_url');
    expect(source).to.have.property('video_url');
    expect(source).to.have.property('api_ref').which.match(/^\/v1\/subjects\/\d+\/eps\/\d+\/sources\/.*$/);
  });
  expect(episode).to.have.property('api_ref').which.match(/^\/v1\/subjects\/\d+\/eps\/\d+$/);
};

/**
 * Test a specific subject object.
 * @function expectASpecificSubjectObject
 * @param {Object} subject A subject object with Bangumi subject ID 120925.
 */
const expectASpecificSubjectObject = (subject) => {
  expect(subject).to.be.a('object');
  expect(subject).to.have.property('id', 120925);
  expect(subject).to.have.property('name_jp', 'Charlotte');
  expect(subject).to.have.property('name_cn', 'Charlotte');
  expect(subject).to.have.property('name_en', 'Charlotte');
  expect(subject).to.have.property('bgm_url', 'https://bgm.tv/subject/120925');
  expect(subject).to.have.property('mal_url', 'https://myanimelist.net/anime/28999');
  expect(subject).to.have.property('website', 'https://charlotte-anime.jp/');
  expect(subject).to.have.property('on_air_date', '2015-07-04T15:00:00.000Z');
  expect(subject).to.have.property('bgm_image_url', 'https://lain.bgm.tv/pic/cover/c/9b/d6/120925_Zp040.jpg');
  expect(subject).to.have.property('summary');
  expect(subject).to.have.property('eps').which.is.a('array').with.length.above(0);
  subject.eps.forEach((episode) => expectAGenericEpisodeObject(episode));
  expect(subject).to.have.property('sources').which.is.a('array').with.length.above(0);
  subject.sources.forEach((source) => {
    expectAGenericSourceObject(source);
    expect(source).to.have.property('subject_url');
    expect(source).to.have.property('api_ref').that.match(/^\/v1\/subjects\/120925\/sources\/.*$/);
  });
};

/**
 * Test a specific source object.
 * @function expectASpecificSourceObject
 * @param {Object} source A source object with ID bilibili.com_cn.
 */
const expectASpecificSourceObject = (source) => {
  expect(source).to.be.a('object');
  expect(source).to.have.property('service_id', 'bilibili.com_cn');
  expect(source).to.have.property('localized_name', '哔哩哔哩');
  expect(source).to.have.property('authorized', true);
  expect(source).to.have.property('paid', 0);
  expect(source).to.have.property('subtitle_locales').which.is.a('array').that.include('zh_CN');
};

/**
 * Test the response returning an error.
 * @function expectError
 * @param {Object} res A response object.
 * @param {number} statusCode A status code.
 */
const expectError = (res, statusCode) => {
  expect(res).to.be.json.and.have.status(statusCode);
  expect(res.body).to.be.a('object').with.property('status', statusCode);
};

/* Tests */
describe('Test API v1', () => {
  describe('GET /subjects', () => {
    it('Getting all subjects returns 200', (done) => {
      request(app).get('/v1/subjects').end((err, res) => {
        expect(res).to.be.json.and.have.status(200);
        expect(res.body).to.be.a('array').with.length.above(0);
        res.body.forEach((subject) => {
          expect(subject).to.be.a('object');
          expect(subject).to.have.property('id').which.is.a('number').and.satisfy(Number.isInteger);
          expect(subject).to.have.property('name_jp');
          expect(subject).to.have.property('name_cn');
          expect(subject).to.have.property('name_en');
          expect(subject).to.have.property('bgm_url');
          expect(subject).to.have.property('mal_url');
          expect(subject).to.have.property('website');
          expect(subject).to.have.property('on_air_date');
          expect(subject).to.have.property('bgm_image_url');
          expect(subject).to.have.property('api_ref').which.match(/^\/v1\/subjects\/\d+$/);
        });
        done();
      });
    });
  });

  describe('GET /subjects/:subjectId', () => {
    it('Getting the subject by active subject ID returns 200', (done) => {
      request(app).get('/v1/subjects/120925').end((err, res) => {
        expect(res).to.be.json.and.have.status(200);
        expectASpecificSubjectObject(res.body);
        done();
      });
    });

    it('Getting the subject by inactive subject ID returns 404', (done) => {
      request(app).get('/v1/subjects/13131').end((err, res) => {
        expectError(res, 404);
        done();
      });
    });

    it('Getting the subject by non-numeric subject ID returns 500', (done) => {
      request(app).get('/v1/subjects/test').end((err, res) => {
        expectError(res, 500);
        done();
      });
    });
  });

  describe('GET /subjects/:subjectId/eps', () => {
    it('Getting all episodes by active subject ID returns 200', (done) => {
      request(app).get('/v1/subjects/120925/eps').end((err, res) => {
        expect(res).to.be.json.and.have.status(200);
        expectASpecificSubjectObject(res.body);
        done();
      });
    });

    it('Getting all episodes by inactive subject ID returns 404', (done) => {
      request(app).get('/v1/subjects/13131/eps').end((err, res) => {
        expectError(res, 404);
        done();
      });
    });

    it('Getting all episodes by non-numeric subject ID returns 500', (done) => {
      request(app).get('/v1/subjects/test/eps').end((err, res) => {
        expectError(res, 500);
        done();
      });
    });
  });

  describe('GET /subjects/:subjectId/eps/:episodeId', () => {
    it('Getting the episode by active subject ID and related episode ID returns 200', (done) => {
      request(app).get('/v1/subjects/120925/eps/541642').end((err, res) => {
        expect(res).to.be.json.and.have.status(200);
        expect(res.body).to.be.a('object');
        expect(res.body).to.have.property('id', 541642);
        expect(res.body).to.have.property('type', 0);
        expect(res.body).to.have.property('airdate', '2015-07-04');
        expect(res.body).to.have.property('sources').which.is.a('array').with.length.above(0);
        res.body.sources.forEach((source) => {
          expectAGenericSourceObject(source);
          expect(source).to.have.property('episode_url');
          expect(source).to.have.property('video_url');
          expect(source).to.have.property('api_ref').which.match(/^\/v1\/subjects\/120925\/eps\/541642\/sources\/.*$/);
        });
        done();
      });
    });

    it('Getting the episode by active subject ID and unrelated numeric episode ID returns 404', (done) => {
      request(app).get('/v1/subjects/120925/eps/541641').end((err, res) => {
        expectError(res, 404);
        done();
      });
    });

    it('Getting the episode by active subject ID and non-numeric episode ID returns 500', (done) => {
      request(app).get('/v1/subjects/120925/eps/test').end((err, res) => {
        expectError(res, 500);
        done();
      });
    });

    it('Getting the episode by inactive subject ID and whatever episode ID returns 404', (done) => {
      request(app).get('/v1/subjects/13131/eps/541642').end((err, res) => {
        expectError(res, 404);
        done();
      });
    });

    it('Getting the episode by non-numeric subject ID and whatever episode ID returns 500', (done) => {
      request(app).get('/v1/subjects/test/eps/541642').end((err, res) => {
        expectError(res, 500);
        done();
      });
    });
  });

  describe('GET /subjects/:subjectId/eps/:episodeId/sources', () => {
    it('Getting all episode sources by active subject ID and related episode ID returns 200', (done) => {
      request(app).get('/v1/subjects/120925/eps/541642/sources').end((err, res) => {
        expect(res).to.be.json.and.have.status(200);
        expect(res.body).to.be.a('array').with.length.above(0);
        res.body.forEach((source) => {
          expectAGenericSourceObject(source);
          expect(source).to.have.property('episode_url');
          expect(source).to.have.property('video_url');
          expect(source).to.have.property('api_ref').which.match(/^\/v1\/subjects\/120925\/eps\/541642\/sources\/.*$/);
        });
        done();
      });
    });

    it('Getting all episode sources by active subject ID and unrelated numeric episode ID returns 404', (done) => {
      request(app).get('/v1/subjects/120925/eps/541641/sources').end((err, res) => {
        expectError(res, 404);
        done();
      });
    });

    it('Getting all episode sources by active subject ID and non-numeric episode ID returns 500', (done) => {
      request(app).get('/v1/subjects/120925/eps/test/sources').end((err, res) => {
        expectError(res, 500);
        done();
      });
    });

    it('Getting all episode sources by inactive subject ID and numeric episode ID returns 404', (done) => {
      request(app).get('/v1/subjects/13131/eps/541642/sources').end((err, res) => {
        expectError(res, 404);
        done();
      });
    });

    it('Getting all episode sources by inactive subject ID and non-numeric episode ID returns 500', (done) => {
      request(app).get('/v1/subjects/13131/eps/test/sources').end((err, res) => {
        expectError(res, 500);
        done();
      });
    });

    it('Getting all episode sources by non-numeric subject ID and whatever episode ID returns 500', (done) => {
      request(app).get('/v1/subjects/test/eps/541642/sources').end((err, res) => {
        expectError(res, 500);
        done();
      });
    });
  });

  describe('GET /subjects/:subjectId/eps/:episodeId/sources/:serviceId', () => {
    it('Getting the episode source by active subject ID, related episode ID and related service ID returns 200', (done) => {
      request(app).get('/v1/subjects/120925/eps/541642/sources/bilibili.com_cn').end((err, res) => {
        expect(res).to.be.json.and.have.status(200);
        expectASpecificSourceObject(res.body);
        expect(res.body).to.have.property('episode_url', 'https://www.bilibili.com/video/BV1gs411S7R6');
        expect(res.body).to.have.property('video_url').which.is.null;
        done();
      });
    });

    it('Getting the episode source by active subject ID, related episode ID and unrelated service ID returns 404', (done) => {
      request(app).get('/v1/subjects/78405/eps/319289/sources/bilibili.com_cn').end((err, res) => {
        expectError(res, 404);
        done();
      });
    });

    it('Getting the episode source by active subject ID, unrelated numeric episode ID and whatever service ID returns 404', (done) => {
      request(app).get('/v1/subjects/120925/eps/541641/sources/bilibili.com_cn').end((err, res) => {
        expectError(res, 404);
        done();
      });
    });

    it('Getting the episode source by active subject ID, non-numeric episode ID and whatever service ID returns 500', (done) => {
      request(app).get('/v1/subjects/120925/eps/test/sources/bilibili.com_cn').end((err, res) => {
        expectError(res, 500);
        done();
      });
    });

    it('Getting the episode source by inactive subject ID, numeric episode ID and whatever service ID returns 404', (done) => {
      request(app).get('/v1/subjects/13131/eps/541642/sources/bilibili.com_cn').end((err, res) => {
        expectError(res, 404);
        done();
      });
    });

    it('Getting the episode source by inactive subject ID, non-numeric episode ID and whatever service ID returns 500', (done) => {
      request(app).get('/v1/subjects/13131/eps/test/sources/bilibili.com_cn').end((err, res) => {
        expectError(res, 500);
        done();
      });
    });

    it('Getting the episode source by non-numeric subject ID, whatever episode ID and whatever service ID returns 500', (done) => {
      request(app).get('/v1/subjects/test/eps/541642/sources/bilibili.com_cn').end((err, res) => {
        expectError(res, 500);
        done();
      });
    });
  });

  describe('GET /subjects/:subjectId/sources', () => {
    it('Getting all subject sources by active subject ID returns 200', (done) => {
      request(app).get('/v1/subjects/120925/sources').end((err, res) => {
        expect(res).to.be.json.and.have.status(200);
        expect(res.body).to.be.a('array').with.length.above(0);
        res.body.forEach((source) => {
          expectAGenericSourceObject(source);
          expect(source).to.have.property('subject_url');
          expect(source).to.have.property('api_ref').that.match(/^\/v1\/subjects\/120925\/sources\/.*$/);
        });
        done();
      });
    });

    it('Getting all subject sources by inactive subject ID returns 404', (done) => {
      request(app).get('/v1/subjects/13131/sources').end((err, res) => {
        expectError(res, 404);
        done();
      });
    });

    it('Getting all subject sources by non-numeric subject ID returns 500', (done) => {
      request(app).get('/v1/subjects/test/sources').end((err, res) => {
        expectError(res, 500);
        done();
      });
    });
  });

  describe('GET /subjects/:subjectId/sources/:serviceId', () => {
    it('Getting the subject source by active subject ID and related service ID returns 200', (done) => {
      request(app).get('/v1/subjects/120925/sources/bilibili.com_cn').end((err, res) => {
        expect(res).to.be.json.and.have.status(200);
        expectASpecificSourceObject(res.body);
        expect(res.body).to.have.property('subject_url', 'https://www.bilibili.com/bangumi/media/md2572/');
        done();
      });
    });

    it('Getting the subject source by active subject ID and unrelated service ID returns 404', (done) => {
      request(app).get('/v1/subjects/78405/sources/acfun.cn').end((err, res) => {
        expectError(res, 404);
        done();
      });
    });

    it('Getting the subject source by inactive subject ID and whatever service ID returns 404', (done) => {
      request(app).get('/v1/subjects/13131/sources/bilibili.com_cn').end((err, res) => {
        expectError(res, 404);
        done();
      });
    });

    it('Getting the subject source by non-numeric subject ID and whatever service ID returns 500', (done) => {
      request(app).get('/v1/subjects/test/sources/bilibili.com_cn').end((err, res) => {
        expectError(res, 500);
        done();
      });
    });
  });
});
