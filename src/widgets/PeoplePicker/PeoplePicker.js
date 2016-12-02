import Widget                   from "common-micro-libs/src/jsutils/Widget"
import EventEmitter             from "common-micro-libs/src/jsutils/EventEmitter"
import dataStore                from "common-micro-libs/src/jsutils/dataStore"
import objectExtend             from "common-micro-libs/src/jsutils/objectExtend"
import parseHTML                from "common-micro-libs/src/jsutils/parseHTML"
import fillTemplate             from "common-micro-libs/src/jsutils/fillTemplate"
import Promise                  from "common-micro-libs/src/jsutils/es6-promise"
import domAddEventListener      from "common-micro-libs/src/domutils/domAddEventListener"
import domAddClass              from "common-micro-libs/src/domutils/domAddClass"
import domRemoveClass           from "common-micro-libs/src/domutils/domRemoveClass"
import domClosest               from "common-micro-libs/src/domutils/domClosest"
import domFind                  from "common-micro-libs/src/domutils/domFind"
import domTriggerEvent          from "common-micro-libs/src/domutils/domTriggerEvent"
import domChildren              from "common-micro-libs/src/domutils/domChildren"
import domPosition              from "common-micro-libs/src/domutils/domPosition"
import domSetStyle              from "common-micro-libs/src/domutils/domSetStyle"
import DomKeyboardInteraction   from "common-micro-libs/src/domutils/DomKeyboardInteraction"

import searchPrincipals         from "../../spapi/searchPrincipals"
import resolvePrincipals        from "../../spapi/resolvePrincipals"
import parsePeopleField         from "../../sputils/parsePeopleField"

import ResultGroup              from "./ResultGroup/ResultGroup"
import PeoplePickerPersona      from "./PeoplePickerPersona/PeoplePickerPersona"
import SPPeoplePickerTemplate   from "./PeoplePicker.html"

import "./PeoplePicker.less"

//-----------------------------------------------------------------------------------------

// FIXME: support for 'Suggested' grouping


const PRIVATE                             = dataStore.create();
const BODY                                = document.body;
const CURRENT_USER_ID                     = '<UserID/>';
const CSS_CLASS_BASE                      = "spwidgets-PeoplePicker";
const CSS_CLASS_SUGGESTIONS_RIGHT_ALIGN   = CSS_CLASS_BASE + "--suggestionsRight";
const CSS_CLASS_IS_ACTIVE                 = "is-active";
const CSS_CLASS_IS_SEARCHING              = "is-searching";
const CSS_CLASS_MS_PICKER_BASE            = "ms-PeoplePicker";
const CSS_CLASS_MS_PICKER_SEARCHBOX       = CSS_CLASS_MS_PICKER_BASE + '-searchBox';
const SELECTOR_BASE                       = "." + CSS_CLASS_BASE;

/**
 * SharePoint People Picker widget.
 *
 * @class PeoplePicker
 *
 * @extends EventEmitter
 * @extends Widget
 *
 * @param {Object} [options]
 *
 * @param {Array|Array<Object>|String} [options.selected=""]
 *  The selected people.
 *
 * @param {Boolean} [options.allowMultiples=true]
 *  Determine whether multiple users can be selected.
 *
 * @param {String} [options.webURL=currentSiteUrl]
 *  The URL of the site. Defaults to the site from where the widget is running.
 *
 * @param {String} [options.type='User']
 *  The type of search to conduct. Default is `User`. Others
 *  include: `None`, `DistributionList`, `SecurityGroup`,
 *  `SharePointGroup`, `All`
 *
 * @param {Number} [options.maxSearchResults=50]
 *  The max number of results to be returned from the server.
 *
 * @param {Number} [options.minLength=2]
 *  The minimum number of characters the user must type before
 *  suggestions are retrieved.
 *
 * @param {String} [options.inputPlaceholder="Type and Pick"]
 *  The text to appear in the HTML5 placeholder attribute
 *  of the input field.
 *
 * @param {String} [options.showSelected=true]
 *  If `true` (default), the selected users by this widget will be shown
 *  on the screen and remembered by the widget.
 *  Set to this `false`, if all that is desired to show is the
 *  search input element. Note that when set to `false`, `getSelected` method
 *  will always return an empty array and the
 *  [remove]{@link PeoplePicker#select} event should be used to capture
 *  the selection made by the user.
 *
 * @param {String} [options.resolvePrincipals=true]
 *  If set to true, any user that is suggested but not yet  part of the
 *  site collection user info list (their id is `-1`) will be automatically
 *  added.
 *
 * @param {Function} [options.filterSuggestions]
 *  A function to filter the Array of results. Function is used in `Array.filter`,
 *  and thus receives as input the array item
 *  (a [PeoplePickerUserProfileModel]{@link PeoplePickerUserProfileModel}) and the index
 *  of the item in the array. Function should return a `Boolean` indicating whether the
 *  item should be kept in the list or no (`true` == keep, `false` don't keep). See
 *  `Array.filter` for more information.
 *
 * @param {Function} [options.resultsZIndex=5]
 *  The CSS `z-index` value to be used for the element that display the search results.
 *
 * @param {String} [options.suggestionsRightAlign=false"]
 *  If true, the search suggestion element is right aligned with the search input
 *  box. good for when widget is close to the right edge of the viewport
 *
 * @param {String} [options.meKeyword="[me]"]
 *  The keyword that will trigger the special entry that represents the currently
 *  logged in user into the list of suggestions. From an API standpoint, this
 *  special entry translates into `<userid/>`. To turn this feature off, just
 *  set this value to an empty string.
 *
 * @param {String} [options.meKeywordLabel="Current User"]
 *  The label that will be shown when the user selects the special entry from the
 *  suggestions.
 *
 * @param {String} [options.searchInfoMsg="Type a value to see list of candidates."]
 * @param {String} [options.searchingMsg="Searching directory..."]
 *
 * @fires PeoplePicker#select
 * @fires PeoplePicker#remove
 */
let PeoplePicker = /** @lends PeoplePicker.prototype */{
    init: function (options) {
        var inst = {
            opt:            objectExtend({}, this.getFactory().defaults, options),
            resultGroup:    null,
            bodyClickEv:    null,
            lastSearchInput:"",
            suppressFocus:  false,
            selected:       [] // array of Persona widgets
        };

        inst.opt.UserProfileModel = inst.opt.UserProfileModel.extend({webURL: inst.opt.webURL});
        PRIVATE.set(this, inst);

        var
        opt         = inst.opt,
        $ui         = this.$ui = parseHTML(
                        fillTemplate(SPPeoplePickerTemplate, opt)
                    ).firstChild,
        uiFind      = $ui.querySelector.bind($ui),
        $input      = inst.$input = uiFind("input[name='search']"),
        $searchBox  = inst.$searchBox = uiFind("." + CSS_CLASS_MS_PICKER_SEARCHBOX),
        $suggestions= inst.$suggestions   = uiFind(SELECTOR_BASE + "-suggestions"),
        requestSuggestions;

        inst.$groups        = uiFind(SELECTOR_BASE + "-suggestions-groups");
        inst.$inputCntr     = uiFind(SELECTOR_BASE + "-searchFieldCntr");

        // Detach the Suggestions element
        $suggestions.parentNode.removeChild($suggestions);

        if (opt.resultsZIndex) {
            domSetStyle($suggestions, {zIndex: opt.resultsZIndex});
        }

        // Add keyboard interaction to the Input field
        var keyboardInteraction = inst.keyboardInteraction = DomKeyboardInteraction.create({
            input:          $input,
            eleGroup:       inst.$groups,
            eleSelector:    `.${CSS_CLASS_BASE}-Result`,
            focusClass:     `${CSS_CLASS_BASE}-Result--focus`
        });

        keyboardInteraction.on("keyEnter", function(){
            if (inst.resultGroup) {
                inst.resultGroup.selectCurrent();
                requestAnimationFrame(function(){
                    $input.value = "";
                });
            }
        });

        keyboardInteraction.on("keyEsc", function(){
            if (!$input.value) {
                domTriggerEvent(BODY, "click");
                $input.blur();
            }
            $input.value = "";
        });

        // Focusing on the Input field, show the suggestions
        // and sets up the event to close it clicking outside of it.
        domAddEventListener($input, "focus", function(){
            this.showResults();
        }.bind(this));

        // On blur: we want to hide the results popup, but only if the user
        // did not leave the input to actually click on a result item. so,
        // we delay the hiding of the results and check later if it was realy
        // a true blur
        // FIXME: blur not realy playing well with results.
        //domAddEventListener($input, "blur", function(){
        //    this.hideResults();
        //}.bind(this));

        // When user types, get suggestions
        domAddEventListener($input, "keyup", function(/*ev*/){
            var //key         = ev.which || ev.keyCode,
                searchInput = String($input.value).trim();

            if (inst.lastSearchInput === searchInput) {
                return;
            }
            inst.lastSearchInput = searchInput;

            if (!searchInput) {
                requestSuggestions = undefined;
                clearSuggestions.call(this);
                return;
            }

            // If not min length, exit
            if (searchInput.length < inst.opt.minLength) {
                clearSuggestions.call(this);
                return;
            }

            var exec = function(){
                if (exec === requestSuggestions) {
                    domAddClass($ui, CSS_CLASS_IS_SEARCHING);
                    domAddClass($suggestions, CSS_CLASS_IS_SEARCHING);

                    getSuggestions.call(this)
                        .then(function(peopleList){
                            showSuggestions.call(this, peopleList);
                            domRemoveClass($ui, CSS_CLASS_IS_SEARCHING);
                            domRemoveClass($suggestions, CSS_CLASS_IS_SEARCHING);
                        }.bind(this))["catch"](function(e){
                            console.log(e); // jshint ignore:line
                        });
                }
            }.bind(this);

            requestSuggestions = exec;

            // After brief delay: get suggestion
            setTimeout(function(){
                exec();
            }, 250);
        }.bind(this));

        // Clicking inside of this widget, but not on a selected element or
        // the input element, places focus on the input
        domAddEventListener($searchBox, "click", function(ev){
            if (ev.target === $searchBox) {
                $input.focus();
            }
        }.bind(this));

        // Listen for when selected users are removed
        this.on("selected-remove", function(userWdg){
            var personModel = userWdg.getUserProfile(),
                selectedIndex;

            userWdg.destroy();

            inst.selected.some(function(selectedWdg, index){
                if (selectedWdg === userWdg) {
                    selectedIndex = index;
                    return true;
                }
            });

            if (typeof selectedIndex !== "undefined") {
                inst.selected.splice(selectedIndex, 1);
            }

            positionResultsPopup.call(this);
            domTriggerEvent($input, "keyup");

            /**
             * A selection was removed
             *
             * @event PeoplePicker#remove
             *
             * @type {UserProfileModel}
             */
            this.emit("remove", personModel);
        }.bind(this));

        // If user Set 'suggestionsRightAlign' then align suggestions to the right
        if (inst.opt.suggestionsRightAlign){
            domAddClass($ui, CSS_CLASS_SUGGESTIONS_RIGHT_ALIGN);
        }

        // If selected people were defined on input, call add()
        if (inst.opt.selected) {
            this.add(inst.opt.selected);
        }

        this.onDestroy(function(){
            // Since the suggestion UI was detached from the widget, need to
            // ensure it is also destroyed.
            if ($suggestions.parentNode) {
                $suggestions.parentNode.removeChild($suggestions);
            }

            inst.selected.forEach(function(wdg){
                if (wdg) {
                    wdg.destroy();
                }
            });
            inst.selected.splice(0);
            PRIVATE['delete'](this);
        }.bind(this));
    },

    /**
     * Clears all selected users.
     */
    clear: function(){
        var selected = PRIVATE.get(this).selected;
        selected.forEach(function(userWdg){
            userWdg.destroy();
        });
        selected.splice(0);
    },

    /**
     * Adds a User to the list of selected items.
     *
     * @param {Object|Array<Object>|String} people
     *  The object defined with the person to be added should have
     *  at least two attributes: `ID` and `AccountName`. If no `ID`
     *  is defined but `AccountName` or DisplayName is, an
     *  API call will be made attempting to identify the person's ID
     *  on the site.
     *  A `String` can also be used, in which case it is assume to be one
     *  in the format normally returned by the SOAP API (ex. ID;#name).
     *  Example of person definition:
     *
     *      {
     *          ID: "123",
     *          AccountName: "John Doe"
     *      }
     *
     * @returns {Promise<Array<PeoplePickerUserProfileModel>, Error>}
     */
    add: function(people){
        if (!Array.isArray(people)) {
            if (typeof people === "string") {
                people = parsePeopleField(people);
            } else {
                people = [people];
            }
        }

        let UserProfileModel = PRIVATE.get(this).opt.UserProfileModel;

        return Promise.all(
            people.map(function(person){
                // If we already have ID and Account Name on input, then
                // just make sure we have as a PeoplePickerUserProfileModel instance
                if (person.ID && (person.ID === CURRENT_USER_ID || person.AccountName)) {
                    if (!person.Name) {
                        person.Name = person.DisplayName || person.AccountName;
                    }

                    if (UserProfileModel.isInstanceOf(person)) {
                        return person;
                    }

                    return UserProfileModel.create(person);
                }

                if (person.AccountName || person.DisplayName || person.Name) {
                    return getSuggestions.call(this, person.AccountName || person.DisplayName || person.Name)
                        .then(function(peopleList){
                            // If Account Name was used and we have 1 match, then that is it
                            if (person.AccountName && peopleList.length === 1) {
                                return peopleList[0];
                            }

                            // Multiple matches.. lets try to match the user
                            // up if possible.
                            var userProfile;
                            peopleList.some(function(personProfile){
                                if (
                                    (person.AccountName && personProfile.AccountName === person.AccountName) ||
                                    (person.DisplayName && personProfile.DisplayName === person.DisplayName) ||
                                    (person.Name && personProfile.Name === person.Name)
                                ) {
                                    userProfile = personProfile;
                                    return true;
                                }
                            });
                            return userProfile;
                        });
                }

                return undefined;
            }.bind(this))
        ).then(function(peopleList){
            peopleList.forEach(function(personModel){
                if (personModel) {
                    addPersonToSelectedList.call(this, personModel);
                }
            }.bind(this));

            return peopleList;

        }.bind(this))["catch"](function(e){
            console.error(e); // jshint ignore:line
            return Promise.reject(e);
        });
    },

    /**
     * Removes a selected user (or a list of users) from the list.
     *
     * @param {String|Array<String>} people
     *  The user or list of users to be removed. Anyone of the following
     *  values can be defined on input: `ID`, `AccountName`, `DisplayName`.
     */
    remove: function(people){
        var inst            = PRIVATE.get(this),
            selectedList    = inst.selected;

        if (!selectedList.length) {
            return;
        }

        if (!Array.isArray(people)) {
            people = [people];
        }

        people.forEach(function(id){
            var wdgToRemove;

            selectedList.some(function(selectedWdg){
                var userProfile = selectedWdg.getUserProfile();

                if (
                    userProfile.ID          === id ||
                    userProfile.UserInfoID  === id ||
                    userProfile.AccountName === id ||
                    userProfile.Name        === id ||
                    userProfile.DisplayName === id
                ) {
                    wdgToRemove = selectedWdg;
                }
            });

            // If we found the person, then emit a 'remove' on it...
            // Widget's events are pipe'd to the PeoplePicker instance
            // as 'selected-remove' which is being listened to.
            if (wdgToRemove) {
                wdgToRemove.emit('remove');
            }
        });
    },

    /**
     * Returns an array of `UserProfileModels` for those that are currently
     * selected.
     *
     * @returns {Array<UserProfileModel>}
     */
    getSelected: function(){
        // FIXME: add methods to returned array to provide easy methods to get array values for update to SP - use Collection
        return PRIVATE.get(this).selected.map(function(userWdg){
            return userWdg.getUserProfile();
        });
    },

    /**
     * Sets focus on the input search element
     */
    setFocus: function(){
        PRIVATE.get(this).$input.focus();
    },

    /**
     * Shows the results UI
     */
    showResults: function(){
        var inst            = PRIVATE.get(this);
        var $input          = inst.$input;
        var $suggestions    = inst.$suggestions;
        var $ui             = this.getEle();

        domAddClass($ui, CSS_CLASS_IS_ACTIVE);
        BODY.appendChild($suggestions);
        positionResultsPopup.call(this);

        domTriggerEvent($input, "keyup");

        if (inst.bodyClickEv) {
            inst.bodyClickEv.remove();
            inst.bodyClickEv = null;
        }

        // Clicking anywhere outside of this widget - removes active class
        inst.bodyClickEv = domAddEventListener(BODY, "click", function(ev){
            var closestPeoplePicker = domClosest(ev.target, SELECTOR_BASE);

            if (!closestPeoplePicker || closestPeoplePicker !== $ui) {
                this.hideResults();
            }
        }.bind(this));
    },

    /**
     * Hides the results UI
     */
    hideResults: function(){
        var inst            = PRIVATE.get(this);
        var $suggestions    = inst.$suggestions;

        if (inst.bodyClickEv) {
            inst.bodyClickEv.remove();
            inst.bodyClickEv = null;
        }

        domRemoveClass(this.getEle(), CSS_CLASS_IS_ACTIVE);
        if ($suggestions.parentNode) {
            BODY.removeChild($suggestions);
        }
        domSetStyle($suggestions, {display: "none"});
        inst.lastSearchInput = "";
        clearSuggestions.call(this);
    }
},

/**
 * People picker user profile model used to model each user profile
 *
 * @class PeoplePickerUserProfileModel
 * @extends UserProfileModel
 */
PeoplePickerUserProfileModel = searchPrincipals.defaults.UserProfileModel.extend(/** @lends PeoplePickerProfileModel.prototype */{
    /**
     * The web URL from where this user was retrieved. Used in resolved principal
     * @type {String}
     */
    webURL: "",

    /**
     * Returns the AccountName url encoded.
     *
     * @returns {string}
     */
    getAccountNameUrlEncoded: function(){
        return encodeURIComponent(this.AccountName);
    },

    /**
     * Resolves the User in the current site by calling the `ResolvePrincipal` API
     *
     * @returns {Promise}
     */
    resolvePrincipal: function(){
        resolvePrincipals({
            webURL:         this.webURL,
            principalKeys:  this.AccountName
        }).then(function(userList){
            // See Issue #42 for the possibility of the results returning
            // multiples, even when only one principalKey was provided on
            // input to the API.
            // https://github.com/purtuga/SPWidgets/issues/42
            userList.some(function(resolvedUser){
                if (
                    resolvedUser.ID &&
                    String(resolvedUser.ID) !== "-1" &&
                    (
                        (
                            resolvedUser.AccountName &&
                            resolvedUser.AccountName === this.AccountName
                        ) ||
                        (
                            resolvedUser.Email &&
                            resolvedUser.Email === this.Email
                        ) ||
                        (
                            resolvedUser.DisplayName &&
                            resolvedUser.DisplayName  === this.DisplayName
                        )

                    )
                ) {
                    this.UserInfoID = this.ID = resolvedUser.ID;
                    return true;
                }

            }.bind(this));
        }.bind(this));
    }
});

function positionResultsPopup() {
    let { $suggestions, $input } = PRIVATE.get(this);

    domSetStyle($suggestions, {
        width:      $input.clientWidth + "px",
        display:    "block"
    });
    domPosition($suggestions, $input);
}

/**
 * Fetches the suggestion for the text entered by the user
 *
 * @private
 *
 * @param {String} [searchString]
 *
 * @return {Promise}
 */
function getSuggestions(searchString) {
    var inst        = PRIVATE.get(this),
        opt         = inst.opt,
        selected    = inst.selected;

    searchString = searchString || inst.$input.value;

    return searchPrincipals({
            webURL:             opt.webURL,
            searchText:         searchString,
            maxResults:         opt.maxSearchResults,
            principalType:      opt.type,
            UserProfileModel:   opt.UserProfileModel
        })
        // filter out those already selected
        .then(function(results){
            var filteredResults = results.slice(0);

            // Insert the "ME" entry if that was the text the user entered
            if (opt.meKeyword && searchString === opt.meKeyword) {
                filteredResults.unshift(
                    opt.UserProfileModel.create({
                        UserInfoID:     CURRENT_USER_ID,
                        DisplayName:    opt.meKeywordLabel
                    })
                );
            }

            filteredResults = filteredResults.filter(function(personModel){
                if (
                    !selected.length ||
                    !selected.some(function(selectedWdg){
                        return selectedWdg.getUserProfile().ID === personModel.ID;
                    })
                ) {
                    return true;
                }
            });

            if (opt.filterSuggestions) {
                filteredResults = filteredResults.filter(opt.filterSuggestions);
            }

            return filteredResults;
        });
}

/**
 * Shows the list of suggestions to the user.
 *
 * @param {Array} peopleList
 *
 * @private
 */
function showSuggestions(peopleList) {
    var inst        = PRIVATE.get(this);

    // FIXME: need to ensure that this set of results matches the last request made for data. Else, don't show it

    clearSuggestions.call(this);

    inst.resultGroup = inst.opt.ResultGroupWidget.create({
        results: peopleList
    });

    inst.resultGroup.appendTo(inst.$groups);

    inst.resultGroup.on("result-click", function(result){
        var resultModel = result.getUserProfile();

        if (String(resultModel.ID) === "-1") {
            resultModel.resolvePrincipal();
        }

        if (inst.opt.showSelected) {
            result.destroy();
            addPersonToSelectedList.call(this, resultModel);
        }

        positionResultsPopup.call(this);

        /**
         * A suggestion was selected.
         *
         * @event PeoplePicker#select
         * @type {PeoplePickerUserProfileModel}
         */
        this.emit("select", resultModel);
    }.bind(this));
}

/**
 * Adds a `PeoplePickerUserProfileModel` person to the list
 * of selected users.
 *
 * @private
 *
 * @param {PeoplePickerUserProfileModel} personModel
 */
function addPersonToSelectedList(personModel){
    var inst        = PRIVATE.get(this),
        $inputCntr  = inst.$inputCntr,
        newSelectedPerson;

    if (!isPersonInSelectedList.call(this, personModel)) {
        if (!inst.opt.allowMultiples) {
            this.clear();
        }

        newSelectedPerson = inst.opt.PersonaWidget.create({userProfile: personModel});
        newSelectedPerson.setSize("xs");
        newSelectedPerson.pipe(this, "selected-");

        $inputCntr.parentNode.insertBefore(newSelectedPerson.getEle(), $inputCntr);
        inst.selected.push(newSelectedPerson);

        positionResultsPopup.call(this);
    }
}

function isPersonInSelectedList(personModel){
    return PRIVATE.get(this).selected.some(function(selectedPerson){
        return selectedPerson.getUserProfile().ID === personModel.ID;
    });
}

/**
 * Clears the current set of suggestions
 *
 * @private
 */
function clearSuggestions(){
    var inst        = PRIVATE.get(this),
        resultGroup = inst.resultGroup;

    if (resultGroup) {
        resultGroup.destroy();
        inst.resultGroup = null;
    }
}

PeoplePicker = EventEmitter.extend(Widget, PeoplePicker);

PeoplePicker.defaults = {
    selected:               "",
    allowMultiples:         true,
    maxSearchResults:       50,
    webURL:                 null,
    type:                   'User',
    inputPlaceholder:       "Type and Pick",
    minLength:              2,
    resultsZIndex:          0,
    showSelected:           true,
    resolvePrincipals:      true,
    meKeyword:              "[me]",
    meKeywordLabel:         "Current User",
    filterSuggestions:      null,
    UserProfileModel:       PeoplePickerUserProfileModel,
    PersonaWidget:          PeoplePickerPersona,
    ResultGroupWidget:      ResultGroup,
    suggestionsRightAlign:  false,
    searchInfoMsg:          "Type a value to see list of candidates. Use '[me]' for current user.",
    searchingMsg:           "Searching directory...",

// FIXME: complete structure for i18n
    i18n: {
        "en-us": {
            inputPlaceholder:   "Type and Pick",
            meKeyword:          "[me]",
            meKeywordLabel:     "Current User",
            searchInfoMsg:      "Type a value to see list of candidates. Use '[me]' for current user.",
            searchingMsg:       "Searching directory..."
        }
    }
};

export default PeoplePicker;

