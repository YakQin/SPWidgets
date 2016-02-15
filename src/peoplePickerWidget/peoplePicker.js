define([
    'jquery',
    'text!./peoplePicker.html',
    '../spapi/getSiteUrl',
    '../spapi/searchPrincipals',
    '../spapi/resolvePrincipals',
    '../sputils/parseLookupFieldValue',
    '../uiutils/addHoverEffect',
    //------------------------
    'less!./peoplePicker'
], function(
    $,
    peoplePickerTemplate,
    getSiteUrl,
    searchPrincipals,
    resolvePrincipals,
    parseLookupFieldValue,
    addHoverEffect
){

    /**
     * jQuery plugin that attaches to an input field and provide a people
     * picker widget for interaction by the user. This Plugin is dependent
     * on jQuery UI's Autocomplete.
     */

    var People = {},
        peoplePicker;

    // Store defaults in SPWidgets object.
    People.defaults = {
        allowMultiples:     true,
        maxSearchResults:   50,
        webURL:             null,
        type:               'User',
        onPickUser:         null,
        onCreate:           null,
        onRemoveUser:       null,
        inputPlaceholder:   "Type and Pick",
        appendTo:           null,
        minLength:          3,
        showSelected:       true,
        resolvePrincipals:  true,
        meKeyword:          "[me]",
        meKeywordLabel:     "Current User",
        filterSuggestions:  null
    };

    /**
     * Given an input field, this method will display an interface that
     * allows the users to select one or more users from SharePoint and
     * stores the selected user information into the intput field in the
     * format expected when making an update via webservices.
     *
     * The input field will be hidden in its current position and a UI
     * will displayed instead. As the user picks or removes users, the
     * input field will be updated at the same time, thus it will always
     * be ready to be submitted as part of an update to the server.
     *
     * @param {HTMLElement|jQuery|Selector} containers
     *      Containers that will receive the peoplePickers
     *
     * @param {Object} options
     *      Object with the options. See below.
     *
     * @param {Boolean} [options.allowMultiples=true]
     *      Determine whether multiple users can be picked.
     *
     * @param {String} [options.webURL=currentSiteUrl]
     *      The URL of the site
     *
     * @param {String} [options.type='User']
     *      The type of search to conduct. Default is User. Others
     *      include: None, DistributionList, SecurityGroup,
     *      SharePointGroup, All
     *
     * @param {Interger} [options.maxSearchResults=50]
     *      The max number of results to be returned from the
     *      server.
     *
     * @param {jQuery}  [options.appendTo=null]
     *      The container where to where the autocomplete suggestion
     *      should be appended.
     *
     * @param {Number} [options.minLength=3]
     *      The minimum number of characters the user must type before
     *      suggestions are retrieved. Given directly to jQuery UI's
     *      Autocomplete widget.
     *
     * @param {Function} [options.onPickUser=null]
     *      Function that is called when user makes a selection.
     *      Function will have a context (this keyword) of the
     *      input field to which this plugin is called on, and
     *      will be given one input param; an object containing
     *      information about the selected user.
     *
     * @param {Function} [options.onCreate=null]
     *      Function that is called after the widget has been
     *      initiated on an input element.
     *      Function will have a context (this keyword) of the
     *      input field to which this plugin is called on, which
     *      will also be provided as the first argument to the
     *      function.
     *
     * @param {Function} [options.onRemoveUser=null]
     *      Function called when removing a user from the selected
     *      list. Returning false (boolean) will cancel the removal
     *      of the person from the selected list.
     *      Function will have a context (this keyword) of the
     *      input field to which this plugin is called on, and is
     *      given 3 input params: $input, $personUI, personObj
     *
     * @param {String} [options.inputPlaceholder="Type and Pick"]
     *      The text to appear in the HTML5 placeholder attribute
     *      of the input field.
     *
     * @param {String} [options.showSelected=true]
     *      If true (default), the selected users by this widget will be shown
     *      on the screen. Set to this false, if all that is desired to show is the
     *      search input element.
     * @param {String} [options.resolvePrincipals=true]
     *      If set to true, any user that is suggested but not yet
     *      part of the site collection user info list (their id
     *      is -1) will be automatically added.
     *
     * @param {Function} [options.filterSuggestions=null]
     *      A callback function to be used in filtering the
     *      suggestions values retrieved from the server. This
     *      callback, if defined, must return an array of objects.
     *
     * @return {jQuery} selection
     *
     *
     * METHODS:
     *
     * $().pickSPUser("method", "clear")
     *      Clears the currently selected users.
     *
     * $().pickSPUser("method", "destroy")
     *      Destroys the widget.
     *
     * $().pickSPUser("method", "add", "person in id;#name format")
     *      adds a person
     *
     * $().pickSPUser("method", "remove", "person id or displayed name")
     *      removes a person
     *
     * $().pickSPUser("method", "getSelected")
     *      Returns array of people selecte.
     *
     *
     * EVENTS:
     *
     * spwidget:peoplePickerCreate
     *          Triggered when the widget is initiated. Event will received
     *          a scope of the input element or whatever object it bubled to
     *          as well as the following input parameter:
     *          1. jQuery Event object
     *          2. Input element that widget was attached to (as jQuery object)
     *
     * spwidget:peoplePickerAdd
     *          Triggered when an item is added to the input field. Event will
     *          receive a scope of the input element or whatever object it
     *          bubbled to, as well as the following input parametes:
     *          1. jQuery Event Object
     *          2. Input element (as jQuery object)
     *          3. Object with information on the user that was added.
     *
     * spwidget:peoplePickerRemove
     *          Triggered when an item is removed from the selected list. Event will
     *          receive a scope of the input element or whatever object it
     *          bubbled to, as well as the following input parametes:
     *          1. jQuery Event Object
     *          2. Input element (as jQuery object)
     *          3. Object with information on the user that was removed.
     *
     *
     */
    peoplePicker = function(containers, options) {

        // Store the arguments given to this function. Used later if the
        // user is trying to execute a method of this plugin.
        var arg     = Array.prototype.slice.call(arguments, 1),
            $this   = $(containers);

        // If input is a string, then it must be an action (method).
        // Process only the first element in the selection.
        if (typeof options === "string") {

            // TODO: should methods support actions on all items in selection?

            return (function(ele){

                if (ele.is("input") && ele.hasClass("hasPickSPUser")){

                    return People.handleAction.apply(ele, arg);

                }

                return $this;

            })( $this.eq(0) );

        }

        // Initiate each selection as a pickSPUser element
        return $this.each(function(){

            var ele = $(this);

            // Options for this element
            var o   = $.extend({},
                    People.defaults,
                    options,
                    {
                        eleUserInput: ele.css("display", "none").addClass("hasPickSPUser")
                    });

            // If no webURL, define it now
            if (!o.webURL) {

                o.webURL = getSiteUrl();
            }

            // insure that maxsearchResults is an interger
            o.maxSearchResults = parseInt(o.maxSearchResults) || 50;

            // Create pick user container and insert it after the input element
            var cntr        = $(peoplePickerTemplate)
                                .find(".pt-pickSPUser").clone(1).insertAfter(ele);

            o.eleSelected   = cntr.find("div.pt-pickSPUser-selected")
                                .empty()
                                .on("click", ".tt-delete-icon", function(){

                                    People.removeUser(this);

                                });

            o.elePickInput  = cntr.find("div.pt-pickSPUser-input");

            /**
             * Checks if a user is already included in the list of selected people
             * in the People Picker widget.
             *
             * @param {String} id
             * @param {String} [name]
             *
             * @return {Boolean}
             */
            o.isUserAlreadySelected = function(id, name) {

                var selector = "div[data-pickspuserid='" + id + "']";

                if (name) {

                    selector += "[data-pickspusername='" + name.replace(/'/g, "\\\'") + "']";

                }

                return (o.eleSelected.find(selector).length > 0);

            };

            /**
             * Adds people to the selected list.
             *
             * @param {String} peopleString
             * @param {Boolean} noEvents
             *
             */
            o.addPeopleToList = function(peopleString, noEvents) {

                var curUsers    = String(peopleString).split(';#'),
                    total       = curUsers.length,
                    i,id,user, $ui;

                // TODO: use parseLookupFieldValue instead of local logic to parse values

                for (i=0; i<total; i++){

                    id = curUsers[i];
                    i++;
                    user    = curUsers[i];

                    if (id.toLowerCase() === "<userid/>") {

                        user = o.meKeywordLabel;

                    }

                    $ui     = People
                                .getUserHtmlElement(o, id, user)
                                .appendTo( o.eleSelected );

                    // Get this user's info. and store it in the input element
                    (function($thisUserUI, thisUserName/*, thisUserId*/){

                        var searchString = thisUserName;

                        if (id.toLowerCase() === "<userid/>") {

                            searchString = o.meKeyword;

                        }

                        o.getSearchResults(searchString)
                            .done(function(rows/*, xData, status*/){

                                var personName = String(thisUserName).toLowerCase();

                                $.each(rows, function(i,v){

                                    // TODO: Should we instead try to match on the ID?
                                    // SP is not consistent how the name is displayed on people pickers.
                                    // trying to get the Person record.

                                    var thisName = String(v.displayName).toLowerCase();

                                    if (thisName === personName) {

                                        $thisUserUI.data("pickspuser_object", v);

                                        return false;

                                    }

                                });

                                // TODO: should something be done if we're unable to find user?

                            });

                    })($ui, user, id);

                }

                addHoverEffect(
                    o.eleSelected.find("div.pt-pickSPUser-person-cntr") );

                // if we don't allow multiple, then hide the input area
                if (o.allowMultiples === false) {

                    o.elePickInput.css("display", "none");

                }

                People.storeListOfUsers(o.eleSelected, noEvents);

            }; //end: o.addPeopleToList()

            /**
             * Searches SP for the value provided on input
             *
             * @param {String} searchString
             *
             * @return {jQuery.Promise}
             *
             */
            o.getSearchResults = function(searchString) {

                return $.Deferred(function(dfd){

                    searchPrincipals({
                        searchText:     searchString,
                        maxResults:     o.maxSearchResults,
                        principalType:  o.type,
                        async:          true,
                        webURL:         o.webURL,
                        completefunc:   function(xData, status){

                            var resp = $(xData.responseXML),
                                rows = [];

                            // If searchString is part of the keyword [me],
                            // then add <UserID>;#current user to the list
                            // of suggestions
                            if (String(o.meKeyword).indexOf(searchString.toLowerCase()) > -1) {

                                rows.push({
                                    displayName:    o.meKeywordLabel,
                                    accountId:      '<UserID/>',
                                    accountName:    o.meKeywordLabel,
                                    accountType:    'User',
                                    // needed attributes for autocomplete
                                    value:          o.meKeywordLabel,
                                    label:          o.meKeywordLabel
                                });

                            }

                            resp.find("PrincipalInfo").each(function(){

                                var thisEle     = $(this),
                                    thisUser    = {
                                        displayName:    thisEle.find("DisplayName").text(),
                                        accountId:      thisEle.find("UserInfoID").text(),
                                        accountName:    thisEle.find("AccountName").text(),
                                        accountType:    thisEle.find("PrincipalType").text(),
                                        email:          thisEle.find("Email").text(),
                                        // needed attributes for autocomplete
                                        value:          thisEle.find("DisplayName").text(),
                                        label:          ''
                                    };

                                // TODO: in the future, need to find a way to show type icon on the suggestions
                                // if (thisUser.accountType === "User") {
//
                                    // thisUser.label = "<img src='/_layouts/images/CheckNames.gif' /> ";
//
                                // } else {
//
                                    // thisUser.label = "<img src='/_layouts/images/ALLUSR.GIF' /> ";
//
                                // }

                                thisUser.label += thisUser.displayName;


                                rows.push(thisUser);

                            });

                            // If a suggestion filter was defined, call it now
                            if (o.filterSuggestions) {


                                rows = o.filterSuggestions(rows);

                            }

                            dfd.resolveWith(xData, [rows, xData, status]);

                        }
                    });

                })
                .promise();

            }; //end: o.getSearchResults()

            // If multiple user are allowed to be picked, then add style to
            // selected input area
            if (o.allowMultiples === true) {

                o.eleSelected.addClass("pt-pickSPUser-selected-multiple");

            }

            // Variable that store all search results
            var cache = {};

            // Add the AutoComplete functionality to the input field
            o.elePickInput.find("input[name='pickSPUserInputField']")
                .attr("placeholder", o.inputPlaceholder)
                .autocomplete({
                    minLength:  o.minLength,
                    appendTo:   o.appendTo || o.elePickInput,
                    source:     function(request, response){
                        // If search term is in cache, return it now
                        if (request.term in cache) {
                            response(cache[request.term]);
                            return;
                        }

                        cache[request.term] = [];

                        // Search SP
                        o.getSearchResults(request.term)
                            .then(function(rows/*, xData, status*/){

                                cache[request.term].push
                                    .apply(
                                        cache[request.term],
                                        rows
                                   );

                                response(cache[request.term]);

                            });

                    },//end:source()
                    /**
                     * Event bound to an autocomplete suggestion.
                     *
                     * @param {jQuery} ev   -   jQuery event.
                     * @param {Object} u    -   An object containing the element generated above
                     *                          by the <source> method that represents the person
                     *                          that was selected.
                     */
                    select: function(ev, u){
                        // If we store only 1 user, then clear out the current values
                        if (o.allowMultiples === false) {

                            o.eleSelected.empty();

                        // Check if already displayed.
                        } else if (
                            o.isUserAlreadySelected(
                                u.item.accountId,
                                u.item.displayName
                            )
                        ) {

                            setTimeout(function(){ev.target.value = "";}, 50);
                            return;

                        }

                        /**
                         * Add the user to the list of selected user
                         */
                        var addToSelectionList = function() {

                            var $newPersonUI = People.getUserHtmlElement(
                                        o, u.item.accountId, u.item.displayName
                                    )
                                    .appendTo( o.eleSelected );

                            // Store a copy of the user object on the UI
                            $newPersonUI.data("pickspuser_object", u.item);

                            People.storeListOfUsers(cntr);

                            addHoverEffect(
                                cntr.find("div.pt-pickSPUser-person-cntr") );

                            // clear out the autocomplete box
                            setTimeout(function(){ev.target.value = "";}, 50);

                            if (o.allowMultiples === false) {
                                o.elePickInput.hide();
                            }

                            // if a callback was defined, call it now
                            if ($.isFunction(o.onPickUser)) {
                                o.onPickUser.call(o.eleUserInput, $.extend({},u.item));
                            }

                            // Triggere event
                            ele.trigger(
                                $.Event("spwidget:peoplePickerAdd"),
                                [ o.eleUserInput, $.extend({},u.item) ]
                            );

                        };

                        // If the user id is NOT -1 (is resolved) or resolvePrincipals
                        // is false, then add user to list now.
                        if (u.item.accountId !== "-1" || !o.resolvePrincipals) {

                            addToSelectionList();

                        // Else, let's resolve the user before we add them.
                        } else {

                            resolvePrincipals({
                                principalKeys: u.item.accountName
                            })
                            .then(function(xmlDoc/*, status*/){

                                // TODO: handle error conditions? (low risk of occuring)

                                var principalInfo = $(xmlDoc).find("PrincipalInfo");

                                // Get and set ID if only one user was returned.
                                // See issue #42 for why we don't try to match on the value
                                // that was searched.
                                // https://github.com/purtuga/SPWidgets/issues/42
                                principalInfo.each(function(){
                                    var $thisPrincipalInfo = $(this);
                                    if (
                                        $thisPrincipalInfo.find("Email").text() === u.item.email ||
                                        $thisPrincipalInfo.find("DisplayName").text() === u.item.displayName
                                    ) {
                                        u.item.accountId = principalInfo.find("UserInfoID").text();
                                        addToSelectionList();
                                        return false;
                                    }
                                });

                            });

                        }

                    }
                });//end:autocomplete


            // If showSelected if false, then hide the selected people area.
            if (!o.showSelected) {
                cntr.find("div.pt-pickSPUser-selected").css("display", "none");
            }

            // Store the options for this call on the container and include a pointer
            // in the input field to this element
            cntr.data("pickSPUserContainerOpt", o);
            ele.data("pickSPUserContainer", cntr);

            // If the current input field has a value defined, then parse it
            // and display the currently defined values
            if (ele.val()) {

                o.addPeopleToList(ele.val(), true);

            }

            // call onCreate if defined
            if ($.isFunction(o.onCreate)) {

                o.onCreate.call(ele, ele);

            }

            // Trigger create event on this instance
            ele.trigger(
                $.Event("spwidget:peoplePickerCreate"),
                [o.eleUserInput]
            );

            return this;
        });

    };// $.fn.pickSPUser()

    /**
     * Builds the html element that surrounds a user for display on the page.
     *
     * @param {Object} opt     -   The options object given to <jQuery.fn.pickSPUser()>
     * @param {String} id      -   The User's Sharepoint UID
     * @param {String} name    -   The User's name.
     *
     * @return {jQuery} Html element
     *
     */
    People.getUserHtmlElement = function(opt, id, name){

        var ele = $(peoplePickerTemplate)
                    .find(".pt-pickSPUser-person").clone(1);
        ele.attr("data-pickSPUserID", id);
        ele.find("span.pt-person-name")
                .append(name)
                .end()
            .attr("data-pickSPUserNAME", name);
        return ele;

    };// People.getUserHtmlElement()


    /**
     * Method is bound to the X (remove) button that appears when the one
     * hovers over the names curerntly displayed. Removes the user from
     * the UI and updates the input field to reflect what is currently
     * displayed.
     *
     * @param {Object} ele -   The HTML element from where this method was
     *                         called. Used to find both the div.pt-pickSPUser
     *                         overall parent element as well as the specific
     *                         .pt-pickSPUser-person element for the user that
     *                         was clicked on.
     *
     * @return {undefined}
     *
     */
    People.removeUser = function(ele){

        var cntr        = $(ele).closest("div.pt-pickSPUser"),
            o           = cntr.data("pickSPUserContainerOpt"),
            $personUI   = $(ele).closest("div.pt-pickSPUser-person"),
            personObj   = $personUI.data("pickspuser_object"),
            doRemove    = true;

        // If an onRemoveUser is defined, then call method
        // and capture response
        if ($.isFunction(o.onRemoveUser)) {

            o.onRemoveUser.call(
                o.ele,
                o.ele,
                $personUI,
                personObj );

        }

        if (doRemove === false) {

            return;

        }

        // remove user from the view
        $personUI.fadeOut('fast', function(){
            $(this).remove();
            People.storeListOfUsers(cntr);
        });

        // if AllowMultiple is false, then make the picker input visible
        if (o.allowMultiples === false) {
            o.elePickInput.show("fast", function(){
                o.elePickInput.find("input").focus();
            });
        }

        // trigger event
        o.eleUserInput.trigger(
            $.Event("spwidget:peoplePickerRemove"),
            [ o.eleUserInput, personObj ]
        );

        return;
    };// People.removeUser()


    /**
     * Method will look at the container that holds the currently selected
     * users and will populate the initial input field given to
     * <jQuery.fn.pickSPUser()> with a sting representing those users.
     *
     *
     * @param {Object} ele -   The HTML element from where this method was
     *                         called. Used to find both the div.pt-pickSPUser
     *                         overall parent element as well as the specific
     *                         .pt-pickSPUser-person element for the user that
     *                         was clicked on.
     *
     * @return {undefined}
     *
     */
    People.storeListOfUsers = function(ele, noEvents){

        var cntr    = $(ele).closest("div.pt-pickSPUser"),
            opt     = cntr.data("pickSPUserContainerOpt"),
            newVal  = "",
            // isDone: keep track of the user already selected,
            // so we don't add them twice to the input field.
            isDone  = {};

        cntr.find("div.pt-pickSPUser-selected div.pt-pickSPUser-person")
            .each(function(){

                var
                $this           = $(this),
                thisUserString  = $this.attr("data-pickSPUserID") + ";#" +
                                    $(this).attr("data-pickSPUserNAME");

                if (isDone[thisUserString]) {

                    return;

                }

                isDone[thisUserString] = true;

                if (newVal) {

                    newVal += ";#";

                }

                newVal += thisUserString;

            });

        opt.eleUserInput.val(newVal);

        if (!noEvents) {

            opt.eleUserInput.change();

        }

        return;
    };// People.storeListOfUsers()

    /**
     * Handles method actions given to $().pickSPUser()
     *
     * @param {String} type
     * @param {String} action
     * @param {Object} options
     *
     * @return {this}
     *
     */
    People.handleAction = function(type, action, options) {

        type    = String(type).toLowerCase();
        action  = String(action).toLowerCase();
        var o   = $(this)
                        .data("pickSPUserContainer")
                        .data("pickSPUserContainerOpt"),
            ret     = this;

        if (type === "method") {

            switch (action) {

                case "clear":

                    o.eleUserInput.val("");
                    o.eleSelected.empty();

                    if (o.allowMultiples === false) {

                        o.eleSelected.css("display", "none");
                        o.elePickInput.show();

                    }

                    break;

                case "destroy":

                    if ( $(this).hasClass('hasPickSPUser')) {

                        $(this).removeClass('hasPickSPUser')
                                .next('.pt-pickSPUser').remove()
                                .show()
                                .trigger('change');

                    }

                    break;

                case "add":

                    o.addPeopleToList(options);

                    break;

                case "remove":

                    if (options) {

                        var rmEle = o.eleSelected
                                .find(
                                    "div[data-pickspuserid='" +
                                    options + "']" );

                        if (!rmEle.length) {

                            rmEle = o.eleSelected
                                .find(
                                    "div[data-pickspusername='" +
                                    options.replace(/'/g, "\\\'") + "']" );

                        }

                        if (rmEle.length) {

                            People.removeUser(rmEle);

                        }

                    }

                    break;

                case "getselected":

                    ret = parseLookupFieldValue(o.eleUserInput.val());

                    break;

            }

        }//end:type===method

        return ret;

    };// People.handleAction()

    peoplePicker.defaults = People.defaults;
    return peoplePicker;

});


