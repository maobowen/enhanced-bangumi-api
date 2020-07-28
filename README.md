![GitHub package.json version](https://img.shields.io/github/package-json/v/maobowen/enhanced-bangumi-api)
![GitHub Top Language](https://img.shields.io/github/languages/top/maobowen/enhanced-bangumi-api)
[![Build Status](https://travis-ci.com/maobowen/enhanced-bangumi-api.svg?branch=master)](https://travis-ci.com/maobowen/enhanced-bangumi-api)
[![Coverage Status](https://coveralls.io/repos/github/maobowen/enhanced-bangumi-api/badge.svg?branch=master)](https://coveralls.io/github/maobowen/enhanced-bangumi-api?branch=master)
![GitHub License](https://img.shields.io/github/license/maobowen/enhanced-bangumi-api)

# Enhanced Bangumi API

This is Enhanced Bangumi API, an API that provides anime-related information. It uses the data semi-manually collected from [here](https://github.com/maobowen/enhanced-bangumi-api-data). 

## Usage

The API is available at `https://bgmapi.bmao.tech/<version>`. The latest API version is `v1` and it supports GET method to the following routes:

| Route | Description | Example |
| --- | --- | --- |
| `/subjects` | Get brief information of all series in the database | [/subjects](https://bgmapi.bmao.tech/v1/subjects) |
| `/subjects/:subjectId`<br/>`/subjects/:subjectId/eps` | Get detailed information of all episodes by `subjectId` | [/subjects/120925](https://bgmapi.bmao.tech/v1/subjects/120925) <br/> [/subjects/120925/eps](https://bgmapi.bmao.tech/v1/subjects/120925/eps) |
| `/subjects/:subjectId/eps/:episodeId` | Get detailed information of an episode by `subjectId` and `episodeId` | [/subjects/120925/eps/541642](https://bgmapi.bmao.tech/v1/subjects/120925/eps/541642) |
| `/subjects/:subjectId/eps/:episodeId/sources` | Get all streaming sources of an episode by `subjectId` and `episodeId` | [/subjects/120925/eps/541642/sources](https://bgmapi.bmao.tech/v1/subjects/120925/eps/541642/sources) |
| `/subjects/:subjectId/eps/:episodeId/sources/:serviceId` | Get a certain streaming source of an episode by `subjectId`, `episodeId` and `serviceId` | [/subjects/120925/eps/541642/sources/bilibili.com_cn](https://bgmapi.bmao.tech/v1/subjects/120925/eps/541642/sources/bilibili.com_cn) |
| `/subjects/:subjectId/sources` | Get all streaming sources of a series by `subjectId` | [/subjects/120925/sources](https://bgmapi.bmao.tech/v1/subjects/120925/sources) |
| `/subjects/:subjectId/sources/:serviceId` | Get a certain streaming source of a series by `subjectId` and `serviceId` | [/subjects/120925/sources/bilibili.com_cn](https://bgmapi.bmao.tech/v1/subjects/120925/sources/bilibili.com_cn) |

| Parameter | Description |
| --- | --- |
| `subjectId` | The subject ID on [Bangumi](https://bgm.tv) |
| `episodeId` | The episode ID on Bangumi |
| `serviceId` | The service ID defined in [the data repository](https://github.com/maobowen/enhanced-bangumi-api-data/blob/master/services.csv) |

For details, please refer to the [API documentation](https://documenter.getpostman.com/view/11163411/T1Dv6to9).

---

© [101对双生儿](https://bmao.tech/) 2020.
