'use strict';

System.register(['lodash', 'moment', './external/jsonpath.js'], function (_export, _context) {
  "use strict";

  var _, moment, JSONPath, _typeof, _createClass, GenericDatasource;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_moment) {
      moment = _moment.default;
    }, function (_externalJsonpathJs) {
      JSONPath = _externalJsonpathJs.JSONPath;
    }],
    execute: function () {
      _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
        return typeof obj;
      } : function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
      };

      _createClass = function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      }();

      _export('GenericDatasource', GenericDatasource = function () {
        function GenericDatasource(instanceSettings, $q, backendSrv, templateSrv, alertSrv, contextSrv, dashboardSrv) {
          _classCallCheck(this, GenericDatasource);

          this.type = instanceSettings.type;
          this.url = instanceSettings.url;
          this.name = instanceSettings.name;
          this.q = $q;
          this.backendSrv = backendSrv;
          this.templateSrv = templateSrv;
          this.withCredentials = instanceSettings.withCredentials;
          this.headers = { 'Content-Type': 'application/json' };
          this.alertSrv = alertSrv;
          this.contextSrv = contextSrv;
          this.dashboardSrv = dashboardSrv;
          this.notificationShowTime = 5000;
          this.topCount = 1000;

          if (typeof instanceSettings.basicAuth === 'string' && instanceSettings.basicAuth.length > 0) {
            this.headers['Authorization'] = instanceSettings.basicAuth;
          }
        }

        _createClass(GenericDatasource, [{
          key: 'getTimeFilter',
          value: function getTimeFilter(options, key) {
            var from = options.range.from.utc().format('YYYY-MM-DDTHH:mm:ss.SSS') + 'Z';
            var to = options.range.to.utc().format('YYYY-MM-DDTHH:mm:ss.SSS') + 'Z';
            return key + ' gt ' + from + ' and ' + key + ' lt ' + to;
          }
        }, {
          key: 'getFormatedId',
          value: function getFormatedId(id) {
            return Number.isInteger(id) || !isNaN(id) ? id : '"' + id + '"';
          }
        }, {
          key: 'query',
          value: async function query(options) {
            var _this = this;

            options.targets = _.filter(options.targets, function (target) {
              return target.hide !== true;
            });

            var allTargetResults = { data: [] };

            var testPromises = options.targets.map(async function (target) {
              var self = _this;
              var subUrl = '';
              var thisTargetResult = {
                'target': target.selectedDatastreamName.toString(),
                'datapoints': []
              };

              if (target.selectedDatastreamDirty) {
                return thisTargetResult;
              }

              if (typeof target.selectedLimit == "undefined") {
                target.selectedLimit = 1;
              }
              var limit = 0;

              if (target.type === "Locations") {
                if (target.selectedLocationId == 0) {
                  return thisTargetResult;
                }
                var timeFilter = _this.getTimeFilter(options, "time");
                subUrl = '/Locations(' + _this.getFormatedId(target.selectedLocationId) + ')/HistoricalLocations?$filter=' + timeFilter + '&$expand=Things($select=name)&$select=time&$top=' + _this.topCount;
              } else if (target.type === "Things" && target.selectedThingOption === "Historical Locations") {
                if (target.selectedThingId == 0) {
                  return thisTargetResult;
                }

                var _timeFilter = _this.getTimeFilter(options, "time");
                subUrl = '/Things(' + _this.getFormatedId(target.selectedThingId) + ')/HistoricalLocations?$filter=' + _timeFilter + '&$expand=Locations($select=name)&$select=time&$top=' + (target.selectedLimit === 0 ? _this.topCount : target.selectedLimit);

                var data = await _this.fetchData(_this.url + subUrl, target.selectedLimit);
                return _this.transformToTable(data, target.selectedLimit, {
                  columns: ["name"],
                  values: [function (v) {
                    return v.Locations[0].name;
                  }]
                }, target);
              } else if (target.type === "Things" && target.selectedThingOption === "Historical Locations with Coordinates") {
                if (target.selectedThingId == 0) {
                  return thisTargetResult;
                }

                var _timeFilter2 = _this.getTimeFilter(options, "time");
                subUrl = '/Things(' + _this.getFormatedId(target.selectedThingId) + ')/HistoricalLocations?$filter=' + _timeFilter2 + '&$expand=Locations($select=name,location)&$select=time&$top=' + (target.selectedLimit === 0 ? _this.topCount : target.selectedLimit);

                var _data = await _this.fetchData(_this.url + subUrl, target.selectedLimit);
                if (target.selectedDatastreamId !== 0) {
                  _data = await _this.dataMergeDatastream(_data, target.selectedDatastreamId);
                }
                return _this.transformToTable(_data, target.selectedLimit, {
                  columns: ["name", "longitude", "latitude", "metric"],
                  values: [function (v) {
                    return v.Locations[0].name;
                  }, function (v) {
                    return self.transformParseLoc(v.Locations[0].location)[0];
                  }, function (v) {
                    return self.transformParseLoc(v.Locations[0].location)[1];
                  }, function (v) {
                    return self.findDataResult(v, target);
                  }]
                }, target);
              } else {
                if (target.selectedDatastreamId == 0) {
                  return thisTargetResult;
                }
                var _timeFilter3 = _this.getTimeFilter(options, "phenomenonTime");
                subUrl = '/Datastreams(' + _this.getFormatedId(target.selectedDatastreamId) + ')/Observations?$filter=' + _timeFilter3 + '&$select=phenomenonTime,result&$orderby=phenomenonTime desc&$top=' + _this.topCount;
              }
              console.log("subUrl:", subUrl);

              var transformedResults = [];
              var hasNextLink = true;
              var fullUrl = _this.url + subUrl;

              while (hasNextLink) {
                if (transformedResults.length >= limit && limit !== 0) {
                  break;
                }

                var response = await _this.doRequest({
                  url: fullUrl,
                  method: 'GET'
                });

                hasNextLink = _.has(response.data, "@iot.nextLink");
                if (hasNextLink) {
                  subUrl = subUrl.split('?')[0];
                  fullUrl = _this.url + subUrl + "?" + response.data["@iot.nextLink"].split('?')[1];
                }

                if (target.type === "Locations") {
                  transformedResults = transformedResults.concat(self.transformThings(target, response.data.value));
                } else {
                  transformedResults = transformedResults.concat(self.transformDataSource(target, response.data.value));
                }
              }

              thisTargetResult.datapoints = transformedResults;

              return thisTargetResult;
            });

            return Promise.all(testPromises).then(function (values) {
              allTargetResults.data = values;
              return allTargetResults;
            });
          }
        }, {
          key: 'dataMergeDatastream',
          value: async function dataMergeDatastream(data, datastreamid) {
            for (var i = 0; i < data.length; i++) {
              var surl = '/Datastreams(' + datastreamid + ')/Observations?$select=result,phenomenonTime&$top=1&$filter=phenomenonTime le ' + data[i]['time'];
              var sdata = await this.fetchData(this.url + surl, 1);
              data[i]['result'] = sdata[0]['result'];
            }
            return data;
          }
        }, {
          key: 'findDataResult',
          value: function findDataResult(data, target) {
            if (typeof data.result === "undefined" || data.result === null) {
              return null;
            }
            if (this.isOmObservationType(target.selectedDatastreamObservationType)) {
              var result = new JSONPath({ json: data.result, path: target.jsonQuery });
              return _typeof(result[0]) === 'object' ? JSON.stringify(result[0]) : result[0];
            } else {
              return _typeof(data.result) === 'object' ? JSON.stringify(data.result) : data.result;
            }
          }
        }, {
          key: 'fetchData',
          value: async function fetchData(url, limit) {
            var result = [];
            var hasNextLink = true;
            var fullUrl = url;
            while (hasNextLink) {
              if (result.length >= limit && limit !== 0) {
                break;
              }

              var response = await this.doRequest({
                url: fullUrl,
                method: 'GET'
              });

              hasNextLink = _.has(response.data, "@iot.nextLink");
              if (hasNextLink) {
                fullUrl = fullUrl.split('?')[0];+"?" + response.data["@iot.nextLink"].split('?')[1];
              }

              result = result.concat(response.data.value);
            }
            return result;
          }
        }, {
          key: 'isOmObservationType',
          value: function isOmObservationType(type) {
            if (_.isEmpty(type)) {
              return false;
            }

            if (!type.includes('om_observation')) {
              return false;
            }

            return true;
          }
        }, {
          key: 'testDatasource',
          value: function testDatasource() {
            return this.doRequest({
              url: this.url,
              method: 'GET'
            }).then(function (response) {
              if (response.status === 200) {
                return { status: 'success', message: 'Data source is working', title: 'Success' };
              }
            });
          }
        }, {
          key: 'metricFindQuery',
          value: async function metricFindQuery(query, subUrl, type) {
            var placeholder = 'select a sensor';

            if (type === 'thing') {
              placeholder = 'select a thing';
            } else if (type === 'datastream') {
              placeholder = 'select a datastream';
            } else if (type === 'location') {
              placeholder = 'select a location';
            }

            var transformedMetrics = [{
              text: placeholder,
              value: 0,
              type: ''
            }];

            var hasNextLink = true;
            var selectParam = type === 'datastream' ? '$select=name,id,observationType' : '$select=name,id';
            var fullUrl = this.url + subUrl + ('?$top=' + this.topCount + '&' + selectParam);

            while (hasNextLink) {
              var result = await this.doRequest({
                url: fullUrl,
                method: 'GET'
              });
              hasNextLink = _.has(result.data, '@iot.nextLink');
              if (hasNextLink) {
                fullUrl = this.url + subUrl + '?' + result.data['@iot.nextLink'].split('?')[1];
              }
              transformedMetrics = transformedMetrics.concat(this.transformMetrics(result.data.value, type));
            }

            return transformedMetrics;
          }
        }, {
          key: 'doRequest',
          value: function doRequest(options) {
            options.withCredentials = this.withCredentials;
            options.headers = this.headers;
            return this.backendSrv.datasourceRequest(options);
          }
        }, {
          key: 'transformParseLoc',
          value: function transformParseLoc(location) {
            if (location.type === 'Feature' && location.geometry.type === 'Point') {
              return location.geometry.coordinates;
            } else if (location.type === 'Point') {
              return location.coordinates;
            } else {
              console.error('Unsupported location type for Thing. Expected GeoJSON Feature.Point or Point.');
              return [0, 0];
            }
          }
        }, {
          key: 'transformToTable',
          value: function transformToTable(data, limit, options, target) {
            if (!data) {
              console.error('Could not convert data to Tableformat, data is not valid.');
              return [];
            }

            if (Array.isArray(data)) {
              if (data.length === 0) {
                console.log('Could not convert data to Tableformat, data is empty.');
                return [];
              }
            }

            if (limit == 0) {
              limit = data.length;
            }
            limit = Math.min(limit, data.length);

            var table = {
              columnMap: {},
              columns: [{ text: "time", type: "time" }],
              meta: {},
              refId: target.refId,
              rows: [],
              type: "table"
            };

            if (options.hasOwnProperty("columns")) {
              for (var i = 0; i < options.columns.length; i++) {
                table.columns.push({ text: options.columns[i] });
              }
            }

            if (options.hasOwnProperty("values")) {
              for (var _i = 0; _i < limit; _i++) {
                var row = [data[_i].time];
                for (var j = 0; j < options.values.length; j++) {
                  row.push(options.values[j](data[_i]));
                }
                table.rows.push(row);
              }
            }
            return table;
          }
        }, {
          key: 'transformDataSource',
          value: function transformDataSource(target, values) {
            var self = this;

            if (self.isOmObservationType(target.selectedDatastreamObservationType) && _.isEmpty(target.jsonQuery)) {
              return [];
            }

            var datapoints = _.map(values, function (value, index) {
              if (self.isOmObservationType(target.selectedDatastreamObservationType)) {
                var result = new JSONPath({ json: value.result, path: target.jsonQuery });

                if (target.panelType === 'table' || target.panelType === 'singlestat') {
                  result = _typeof(result[0]) === 'object' ? JSON.stringify(result[0]) : result[0];
                  return [result, parseInt(moment(value.phenomenonTime, 'YYYY-MM-DDTHH:mm:ss.SSSZ').format('x'))];
                } else {
                  return [result[0], parseInt(moment(value.phenomenonTime, 'YYYY-MM-DDTHH:mm:ss.SSSZ').format('x'))];
                }
              } else {
                if (target.panelType === 'table') {
                  return [_.isEmpty(value.result.toString()) ? '-' : value.result, parseInt(moment(value.phenomenonTime, 'YYYY-MM-DDTHH:mm:ss.SSSZ').format('x'))];
                } else {
                  return [value.result, parseInt(moment(value.phenomenonTime, 'YYYY-MM-DDTHH:mm:ss.SSSZ').format('x'))];
                }
              }
            });

            datapoints = _.filter(datapoints, function (datapoint) {
              return typeof datapoint[0] === 'string' || typeof datapoint[0] === 'number' || Number(datapoint[0]) === datapoint[0] && datapoint[0] % 1 !== 0;
            });

            return datapoints;
          }
        }, {
          key: 'transformThings',
          value: function transformThings(target, values) {
            return _.map(values, function (value) {
              return [_.isEmpty(value.Thing.name) ? '-' : value.Thing.name, parseInt(moment(value.time, 'YYYY-MM-DDTHH:mm:ss.SSSZ').format('x'))];
            });
          }
        }, {
          key: 'transformMetrics',
          value: function transformMetrics(metrics, type) {
            var transformedMetrics = [];

            _.forEach(metrics, function (metric, index) {
              transformedMetrics.push({
                text: metric.name + ' ( ' + metric['@iot.id'] + ' )',
                value: metric['@iot.id'],
                type: metric['observationType']
              });
            });

            return transformedMetrics;
          }
        }]);

        return GenericDatasource;
      }());

      _export('GenericDatasource', GenericDatasource);
    }
  };
});
//# sourceMappingURL=datasource.js.map
