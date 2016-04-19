define([
    "../sputils/cache",
    "../sputils/getNodesFromXml",
    "../models/ListItemModel",

    "../sputils/apiFetch",
    "../spapi/getSiteWebUrl",

    "vendor/jsutils/objectExtend"
], function(
    cache,
    getNodesFromXml,
    ListItemModel,

    apiFetch,
    getSiteWebUrl,

    objectExtend
){

    /**
     * Method to retrieve data from a SharePoint list using GetListItems or
     * GetListItemChangesSinceToken operations of the List.axps webservice.
     * @function
     *
     * @param {Object} options
     *      Supports same input options as SPServices
     *
     * @param {Object} options.listName
     *
     * @param {String} [options.webURL="currentSiteWeb"]
     *
     * @param {String} [options.viewName=""]
     *
     * @param {String} [options.CAMLViewFields=""]
     *
     * @param {String} [options.CAMLQuery=""]
     *
     * @param {String} [options.CAMLQueryOptions=""]
     *
     * @param {String|Number} [options.CAMLRowLimit=""]
     *
     * @param {String} [options.operation="GetListItems"]
     *      Value Could also be set to "GetListItemChangesSinceToken".
     *
     * @param {Boolean} [options.changeToken=""]
     *      Used only when options.operation is "GetListItemChangesSinceToken"
     *
     * @param {Boolean} [options.cacheXML=false]
     *
     * @param {Boolean} [options.listItemModel=ListItemModel]
     *  The model to be used for each row retrieved. Model constructor must
     *  support a .create() method.
     *
     * @return {Promise<Array>|Promise<Error>}
     *   Promise is resolved with a Collection, or rejected with an Error object
     *
     * @see https://msdn.microsoft.com/en-us/library/websvclists.lists.getlistitems(v=office.14).aspx
     */
    var getListItems = function(options){

        var opt = objectExtend({}, getListItems.defaults, options),
            reqPromise;

        return getSiteWebUrl(opt.webURL).then(function(webURL){
            opt.webURL      = webURL + "_vti_bin/Lists.asmx";
            opt.cacheKey    = opt.webURL + "?" +
                            [
                                opt.listName,
                                opt.viewName,
                                opt.CAMLViewFields,
                                opt.CAMLQuery,
                                opt.CAMLRowLimit,
                                opt.CAMLQueryOptions,
                                opt.operation,
                                opt.changeToken
                            ].join("|");
            opt.isCached    = cache.isCached(opt.cacheKey);

            // If cacheXML is true and we have a cached version, return it.
            if (opt.cacheXML && opt.isCached) {
                return cache(opt.cacheKey);
            }

            // If cacheXML is FALSE, and we have a cached version of this key,
            // then remove the cached version - basically reset
            if (opt.isCached) {
                cache.clear(opt.cacheKey);
            }

            reqPromise = apiFetch(opt.webURL, {
                method:     "POST",
                headers:    { 'Content-Type': 'text/xml;charset=UTF-8' },
                body:       "<?xml version=\"1.0\" encoding=\"utf-8\"?><soap:Envelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">" +
                            "<soap:Body>" +"<" + opt.operation + " xmlns=\"http://schemas.microsoft.com/sharepoint/soap/\"><listName>" +
                            opt.listName + "</listName><viewName>" +
                            (opt.viewName || "") +
                            "</viewName><query>" +
                            (opt.CAMLQuery || "<Query></Query>") +
                            "</query><viewFields>" +
                            (opt.CAMLViewFields || "<ViewFields></ViewFields>") +
                            "</viewFields><rowLimit>" +
                            (opt.CAMLRowLimit || 0) +
                            "</rowLimit><queryOptions>" +
                            (opt.CAMLQueryOptions || "<QueryOptions></QueryOptions>") +
                            "</queryOptions>" +
                            (
                                opt.operation === "GetListItemChangesSinceToken" ?
                                "<changeToken>" + opt.changeToken + "</changeToken>" :
                                    ""
                            ) +
                            "</" + opt.operation +"></soap:Body></soap:Envelope>"
            }).then(function(response){
                return getNodesFromXml({
                    xDoc:       response.content,
                    nodeName:   "z:row",
                    nodeModel:  opt.listItemModel
                });
            });

            // If cacheXML was true, then cache this promise
            if (opt.cacheXML) {
                cache(opt.cacheKey, reqPromise);
            }

            return reqPromise;
        });
    };

    getListItems.defaults = {
        listName:       '',
        webURL:         '',
        viewName:       '',
        CAMLViewFields: '',
        CAMLQuery:      '',
        CAMLRowLimit:   '',
        CAMLQueryOptions:   '',
        operation:      'GetListItems', // Optionally: set it to = GetListItemChangesSinceToken
        cacheXML:       false,
        async:          true,
        changeToken:    '', // GetListChangesSinceToken only
        listItemModel:  ListItemModel
    };

    return getListItems;
});
