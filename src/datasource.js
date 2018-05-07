import _ from "lodash";
import moment from "moment";
export class GenericDatasource {

    constructor(instanceSettings, $q, backendSrv, templateSrv) {

        this.type = instanceSettings.type;
        this.url = instanceSettings.url;
        this.name = instanceSettings.name;
        this.q = $q;
        this.backendSrv = backendSrv;
        this.templateSrv = templateSrv;
        this.withCredentials = instanceSettings.withCredentials;
        this.headers = {'Content-Type': 'application/json'};
        if (typeof instanceSettings.basicAuth === 'string' && instanceSettings.basicAuth.length > 0) {
            this.headers['Authorization'] = instanceSettings.basicAuth;
        }
    }

    getTimeFilter(options){
        let from = options.range.from.format("YYYY-MM-DDTHH:mm:ss.SSS")+"Z";
        let to = options.range.to.format("YYYY-MM-DDTHH:mm:ss.SSS")+"Z";
        return "phenomenonTime gt " + from + " and phenomenonTime lt " + to;
    }

    sleep(delay) {
        var start = new Date().getTime();
        while (new Date().getTime() < start + delay){

        };
    }

    query(options) {
        // console.log(options);

        // Filter targets that are set to hidden
        options.targets = _.filter(options.targets, target => {
            return target.hide != true;
        });

        let allPromises = [];
        let allTargetResults = {data:[]};
        let self = this;
        let timeFilter = this.getTimeFilter(options);

        // /Datastreams(16)/Observations?$filter=phenomenonTime%20gt%202018-03-14T16:00:12.749Z%20and%20phenomenonTime%20lt%202018-03-14T17:00:12.749Z&$select=result,phenomenonTime

        _.forEach(options.targets,function(target){

            let self = this;

            let suburl = '';

            if (_.isEqual(target.type,"Location")) {
                if (target.locationTarget == 0) return;
                suburl = '/Locations(' + target.locationTarget + ')/HistoricalLocations?$expand=Things';
            } else {
                if (target.datastreamID == 0) return;
                suburl = '/Datastreams('+target.datastreamID+')/Observations?'+'$filter='+timeFilter;
            }

            allPromises.push(this.doRequest({
                url: this.url + suburl,
                method: 'GET'
            }).then(function(response){
                let transformedResults = [];
                if (_.isEqual(target.type,"Location")) {
                    transformedResults = self.transformThings(target,response.data.value);
                } else {
                    transformedResults = self.transformDataSource(target,response.data.value);
                }
                return transformedResults;
            }));

        }.bind(this));

        return Promise.all(allPromises).then(function(values) {
            _.forEach(values,function(value){
                allTargetResults.data.push(value);
            });
            return allTargetResults;
        });
    }

    transformDataSource(target,values){
        return {
            'target' : target.dsTarget.toString(),
            'datapoints' : (values.length == 0) ? [] : _.map(values,function(value,index){
                return [value.result,parseInt(moment(value.resultTime,"YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))];
            })
        };
    }

    transformThings(target,values){
        return {
            'target' : target.selectedLocation.toString(),
            'datapoints' : (values.length == 0) ? [] : _.map(values,function(value,index){
                return [value.Thing.name,parseInt(moment(value.time,"YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))];
            })
        };
    }

    testDatasource() {
        return this.doRequest({
            url: this.url,
            method: 'GET',
        }).then(response => {
            if (response.status === 200) {
                return { status: "success", message: "Data source is working", title: "Success" };
            }
        });
    }

    annotationQuery(options) {
        var query = this.templateSrv.replace(options.annotation.query, {}, 'glob');
        var annotationQuery = {
            range: options.range,
            annotation: {
                name: options.annotation.name,
                datasource: options.annotation.datasource,
                enable: options.annotation.enable,
                iconColor: options.annotation.iconColor,
                query: query
            },
            rangeRaw: options.rangeRaw
        };

        return this.doRequest({
            url: this.url + '/annotations',
            method: 'POST',
            data: annotationQuery
        }).then(result => {
            return result.data;
        });
    }

    metricFindQuery(query,suburl) {
        // var interpolated = {
        //     target: this.templateSrv.replace(query, null, 'regex')
        // };

        return this.doRequest({
            url: this.url + suburl,
            // data: interpolated,
            method: 'GET',
        }).then(this.mapToTextValue);
    }

    LocationFindQuery(query,suburl) {
        return this.doRequest({
            url: this.url + suburl,
            // data: interpolated,
            method: 'GET',
        }).then((result) => {
            let allLocations = [{
                text: "select a location",
                value: 0
            }];
            _.forEach(result.data.value, (data,index) => {
                allLocations.push({
                    text: data.name + " ( " + data.description + " )",
                    value : data['@iot.id'],
                });
            });
            return allLocations;
        });
    }

    mapToTextValue(result) {
        return _.map(result.data.value, (data,index) => {
            return {
                text: data.name + " ( " + data['@iot.id'] + " )",
                value: data.name + " ( " + data['@iot.id'] + " )",
                id: data['@iot.id']
            };
        });
    }

    doRequest(options) {
        options.withCredentials = this.withCredentials;
        options.headers = this.headers;

        return this.backendSrv.datasourceRequest(options);

    }

    buildQueryParameters(options) {
        //remove placeholder targets
        options.targets = _.filter(options.targets, target => {
            return target.dsTarget !== 'select metric';
        });

        var targets = _.map(options.targets, target => {
            return {
                target: this.templateSrv.replace(target.dsTarget.toString(), options.scopedVars, 'regex') ,
                refId: target.refId,
                hide: target.hide,
                type: target.type || 'timeserie'
            };
        });

        options.targets = targets;
        console.log(options);
        return options;
    }
}
