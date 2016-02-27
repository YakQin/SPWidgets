define([
    'jquery',
    '../spapi/getSiteUrl',
    '../spapi/getListColumns',
    '../spapi/getListFormCollection',
    '../spapi/getListItems',
    '../spapi/updateListItems',
    '../sputils/getNodesFromXml',
    '../sputils/fillTemplate',
    '../uiutils/makeSameHeight',
    '../uiutils/addHoverEffect',
    '../sputils/doesMsgHaveError',
    '../sputils/getMsgError',
    'text!./board.html',
    //-----------------------------
    'less!./board'
], function(
    $,
    getSiteUrl,
    getListColumns,
    getListFormCollection,
    getListItems,
    updateListItems,
    getNodesFromXml,
    fillTemplate,
    makeSameHeight,
    addHoverEffect,
    doesMsgHaveError,
    getMsgError,
    boardTemplate
){

    /**
     * Displays data from a list in Kan-Ban board using a specific column from
     * that list.  Column (at this point) is assume to be a CHOICE type of field.
     * @namespace board
     */
    var
    Board   = {},
    showBoard,
    getBoardStates,
    CSS_HIDDEN_CLASS_NAME = "spwidget-board-state-hidden";

    /** @property {Integer} The max number of columns that can be built (not displayed) */
    Board.maxColumns = 20;

    /**
     * Board widget default options.
     * @name board.defaults
     * @type {Object}
     */
    Board.defaults = {
        list:                   '',
        field:                  '',
        CAMLQuery:              '<Query></Query>',
        CAMLViewFields:         '',
        fieldFilter:            null,
        optionalLabel:          '(none)',
        allowFieldBlanks:       null,
        template:               null,
        webURL:                 '',
        showColPicker:          false,
        colPickerLabel:         "Columns",
        colPickerVisible:       [],
        colPickerCloseLabel:    "Close",
        colPickerApplyLabel:    "Apply",
        colPickerCheckLabel:    "Check-Uncheck All",
        colPickerTotalLabel:    "Selected.",
        colPickerMaxColMsg:     "Can not exceed 10 columns!",
        colPickerMinColMsg:     "Mininum of 2 required!",
        onGetListItems:         null,
        onPreUpdate:            null,
        onBoardCreate:          null,
        height:                 null
    };

    /**
     * Given a selector, this method will insert a Kan-Ban board inside
     * of it with data retrieved from a specific list.
     * This widget will retrieve the List definition upon first call
     * and setting cache = true. In some implementations
     * it may be desirable to get these defintions ahead of calling this
     * widget so that a cached version is used.
     *
     * @param {HTMLElement|jQuery|Selector} containers
     *      The elements where the board will be created.
     *
     * @param {Object} options
     *
     * @param {String} options.list
     *                  The list name or UID.
     *
     * @param {String} options.field
     *                  The field from the List from where the board should
     *                  be built from. This field should be either of type
     *                  CHOICE or LOOKUP.
     *
     * @param {Null|Boolean} [options.allowFieldBlanks=null]
     *                  Control whether an additional board state is shown that
     *                  allows user to move a task to blank value (value in the column
     *                  is blank). Possible values are:
     *                  `null` - (default) widget will try to
     *                  figure it out based on the Field definition in the list.
     *                  `true` - Always show "none" column. Note that if the field is
     *                  setup as Required, updates to the item may fail.
     *                  `false` - Always hide the "none" column, regardless of the
     *                  field definition. Note that if your data has item with blanks
     *                  for the field, those item will not be shown on the board.
     *
     *
     * @param {String|Function} [options.CAMLQuery="<Query></Query>"]
     *                  String with CAML query to be used against the list
     *                  to filter what is displayed or a function that will
     *                  provide the list of items (an array). If defining
     *                  a Function, it will be given two input parameter:
     *                  1) a function that must be called and be given the
     *                  array of items.
     *                  2) The options defiend on input to this widget.
     *                  The user defined function will be given a scope
     *                  (this keyword) of the html element it was bound to.
     *                  Example:
     *                  options.CAMLQuery = '<Query><Where>\
     *                          <FieldRef Name="Project" />\
     *                          <Value Type="Text">Latin America</Value>\
     *                      </Where></Query>';
     *                  --or--
     *                  options.CAMLQuery = function(sendResults) {
     *                      //get items from DB
     *                      sendResults([...]);
     *                  }
     *
     * @param {String} [options.CAMLViewFields=""]
     *                  String in CAML format with list of fields to be
     *                  returned from the list when retrieving the rows
     *                  to be displayed on the board.
     *
     * @param {String} [options.fieldFilter=""]
     *                  A string with either a comma delimetered list of
     *                  column values to show if field is of CHOICE type;
     *                  or a string with a CAML query to filter field values,
     *                  if field is of type Lookup
     *
     * @param {String} [options.optionalLabel="(none)"]
     *                  The string to be used as the State column header when
     *                  field from where Board was built is optional in the
     *                  List.
     *
     * @param {String|Function} [options.template="<div></div>"]
     *                  The HTML template that will be used to for displaying
     *                  items on the board. The HTML can be defined with tokens
     *                  in the format of {{Column_Internal_Name}}.
     *                  When defining a Function, it will be called with
     *                  a context of the board Html Element container and be
     *                  given two input params:
     *                  1. Item data object
     *                  2. Null || jQuery object
     *
     *                  Example:
     *
     *                      function(listItemObj, $ItemUI){
     *                          // this = jQuery - the container of the board.
     *                      }
     *
     * @param {String} [options.webURL=currentSiteUrl]
     *                  The WebURL for the list.
     *
     * @param {Boolean} [options.showColPicker=false]
     *                  If true, the column picker option will be displayed
     *                  on the page. Allows user to pick which column are
     *                  visible/hidden.
     *
     * @param {Array} [options.colPickerVisible=[]]
     *                  The list of board columns that should be visible. Used
     *                  only when showColPicker is true.
     *
     * @param {String} [options.colPickerLabel="Columns"]
     *                  The label for the column picker button.
     *
     * @param {String} [options.colPickerCloseLabel="Close"]
     *                  The label for the column picker pop-up close button
     *
     * @param {String} [options.colPickerCheckLabel="Apply"]
     *                  Label for the Check all/uncheck all
     *
     * @param {String} [options.colPickerApplyLabel="Apply"]
     *                  The label for the column picker pop-up apply button
     *
     * @param {String} [options.colPickerMaxColMsg="Can not exceed 10 columns!"]
     *                  Message to display when more than 10 columns were selected
     *
     * @param {String} [options.colPickerMinColMsg="Minimum of 2 required!"]
     *                  Message to display when less then 2 columsn were selected
     *
     * @param {String} [options.colPickerTotalLabel="Selected."]
     *                  The label for the number of column selected text on
     *                  the column picker popup.
     *
     * @param {Function} [options.onGetListItems=null]
     *                  Callback function to be called after data has been
     *                  retrieved from the 'list'. Function will be given a
     *                  scope (this) of the selection they used on input to
     *                  this method and two input parameters:
     *                  An Array of Objects with the list of rows returned
     *                  from the List, and
     *                  A jQuery object representing the entire xml document
     *                  response.  Example:
     *
     *                      onGetListItems: function(items, xmlResponse){
     *                          //this = jQuery element container selction
     *                      }
     *
     * @param {Function} [options.onPreUpdate=null]
     *                  Callback function to be called just prior to a List Item
     *                  update. The callback will have a scope of the item being
     *                  updated and be given 2 parameters:
     *                  1) the event object,
     *                  2) the item (DOM element) that triggered the event and
     *                  3) a data object with information/methods for the current
     *                     item/widget binding. The object will include two
     *                     attributes that will impact the updates:
     *                      data.updates - An array of updates that will be made.
     *                          The array will have, to start, the update to the
     *                          state that was triggered by the move in the board.
     *                          Additional updates can be added.
     *                          Format will be an Array-of-Arrays, where each sub-array
     *                          must have 2 items: the column name (index 0) and
     *                          the column value (index 1). Example:<br/>
     *
     *                          data.updates = [
     *                              ["Status", "Done"]
     *                          ];
     *                          // insert additional update
     *                          data.updates.push(["Title", "New title here"]);
     *
     *                      data.updatePromise - A jQuery.Promise that represents
     *                          the update that will be made. This can be used to
     *                          bind on additional functionality. The queued functions
     *                          will be given the following as input:
     *
     *                              updatePromise.then(function(newItemObj, oldItemObj, xData){
     *                                  // this = jQuery of the row container on the board
     *                              })
     *
     *                          -   The update item object (as returned by SP)
     *                          -   current item object (the one used to display the item on the board)
     *                          -   XML Document of the response from SP (xData)
     *
     *                  The function should return a boolean indicating whether the
     *                  update should be canceled. True will cancel the update.
     *                  Example:
     *
     *                      onPreUpdate: function(ev, item, data){
     *                          //this = jQuery element container selction
     *                      }
     *
     * @param {Function} [options.onBoardCreate=null]
     *                  Function triggered after board is initially created.
     *                  See spwidget:boardcreate even for parameters that
     *                  will be given to function.
     *
     * @param {String}  [options.height=null]
     *                  The height for the board. This value should be a valid CSS
     *                  dimention (ex. integer + unit - 100px). Default is null,
     *                  indicating that its not fixed height (entire board is expanded)
     *
     * @return {jQuery} this
     *
     *
     * @example
     *
     *      $("#boardContainer").SPShowBoard({
     *          list:   "Tasks",
     *          field:  "Status"
     *      });
     *
     *
     * EVENTS TRIGGERED BY THIS PLUGIN:
     *
     *  spwidget:boardchange,
     *  spwidget:boardcreate    -   Events triggered anytime a change happens
     *                              in the board or when the board is first created.
     *                              Event is provided 3 parameters
     *                              1) the event object,
     *                              2) the item (DOM element) that triggered
     *                                 the event and
     *                              3) a data object with information/methods for the current
     *                                 item/widget binding.  The objects's .updates attribute
     *                                 will contain an array of array's with the updates that
     *                                 will be made to the item.
     *                              The function's 'this'
     *                              variable will point to the column element that
     *                              received the new item.
     *
     *                              Example:
     *
     *                                  ele.on("spwidget:boardchange", function(ev, item, data){
     *                                      // this = ele;
     *                                  })
     *
     * spwidget:boarditemadd    -   Event triggered when new items are added to the
     *                              board (ex. from a refresh). Event will be given
     *                              the following input params:
     *                              1) the event object (jquery)
     *                              2) the item (DOM element) that triggered
     *                                 the event and
     *                              3) a data object with information/methods for the current
     *                                 item/widget binding.  The objects's .itemsModified attribute
     *                                 will contain an array of Objects  that were added.
     *
     * spwidget:boarditemremove -   Event triggered when items are removed from the
     *                              board (ex. from a refresh). Event will be given
     *                              the following input params:
     *                              1) the event object (jquery)
     *                              2) the board container (DOM element)
     *                              3) a data object with information/methods for the current
     *                                 item/widget binding.  The objects's .itemsModified attribute
     *                                 will contain an array of Objects that were removed.
     *
     * spwidget:boardColumnChange -   Event triggered when columns on the board are changed.
     *                              Event will be given the following input params:
     *                              1) jQuery: the event object (jquery)
     *                              2) jQuery: the board container (DOM element)
     *                              3) Object of Column Names currently visible. Key is internal
     *                                 static name, while value is the external visible name.
     *                                 For boards created from CHOICE values, key and value is
     *                                 the same.
     *
     *                              $("#board")
     *                                  .on(
     *                                      "spwidget:boardColumnChange",
     *                                      function($board, columnsObj){
     *                                          //this = $board object
     *                                      })
     *
     *
     *
     *
     * AVAILABLE METHODS:
     *
     *  refresh     -   Refreshes the data in the Board by retrieving the data
     *                  from the list again. During a refresh, existing board
     *                  items (the html element in DOM) is not actually deleted
     *                  and recreated if it already exists, but re-used. It is
     *                  important to note this specially if a custom template
     *                  function was defined as an input param.
     *
     *                  $().SPShowBoard("refresh");
     *
     * redraw       -   Redraws the board without pulling in data from the list.
     *                  Column heights will be normalized and jQuery UI's sortable
     *                  widget will be refreshed.
     *
     *                  $().SPShowBoard("redraw");
     *
     * setVisible   -   Sets which Board columns should be visible.  Method takes
     *                  as input an array of board column values (the visible name)
     *
     *                  $().SPShowBoard("setVisible", ['Not Started', 'Completed']);
     *
     *
     * setHeight    -   Sets the height of the board by applying the value passed in
     *                  to the column area that holds the cards. Use null to remove
     *                  the height.
     *                  Example:
     *                      $().SPShowBoard("setHeight", "300px");
     *                      $().SPShowBoard("setHeight", null);
     *
     * getColumns   -   Returns an array board columns. Array will include a list of
     *                  object that each represent a column in the board. The object
     *                  will contain the following information:
     *
     *                      {
     *                          name: 'internal name',
     *                          title: 'external name',
     *                          isVisible: true|false
     *                      }
     *
     * // TODO: Destroy method (must remove all event bindings)
     * // TODO: move method - moves an item on the board (identified by ID) to
     *          a different state
     *
     *
     */
    showBoard = function(containers, options){

        // TODO: need to determine how to page large datasets.

        // Capture original set of input options (no containers).
        var args    = Array.prototype.slice.call(arguments, 1),
            retVal  = containers;

        // Attach the board to each element
        containers.each(function(){

            var ele         = $(this),
                isMethod    = (typeof options === "string"),
                hasBoard    = ele.hasClass("hasSPShowBoard"),
                opt         = null,
                method      = '',
                board       = null;

            // if this element alraedy has a board on it, and
            // options is not a string, then exit.
            if ( hasBoard && !isMethod ) {

                return this;

            // Handle METHODS
            } else if (isMethod && hasBoard && !ele.hasClass("loadingSPShowBoard")) {

                method  = options.toLowerCase();
                board   = ele.data("SPShowBoardOptions");

                //*** REFRESH ***
                if (method === "refresh") {

                    board._getListItems().then(function(){

                        board.showItemsOnBoard({ refresh: true });

                    });

                //*** REDRAW ***
                } else if (method === "redraw") {

                    board.setBoardColumnHeight();

                //*** SETVISIBLE ***
                } else if (method === "setvisible") {

                    board.setUserDefinedVisibleCol( args[1] );

                //*** SETHEIGHT ***
                } else if (method === "setheight") {

                    board.height = args[1];
                    board.setBoardColumnHeight();

                //*** GET COLUMNS ***
                } else if (method === "getcolumns") {

                    retVal = board.getBoardColumnList();

                }//end: if(): methods

                return this;

            }//end: if()

            // If this element is already loading the UI, exit now
            if (ele.hasClass("loadingSPShowBoard")) {

                return this;

            }

            // Define this Widget instance
            opt = $.extend({},
                Board.defaults,
                options,
                {
                    ele:                ele,
                    states:             [], // List of states
                    statesMap:          {}, // Map of State->object in states[]
                    tmpltHeader:        '', // Header template
                    tmpltState:         '', // State item template
                    statesCntr:         '', // DOM element where rows are located
                    headersCntr:        '', // DOM element where headers are located
                    listItems:          [], // Array with items from the list.
                    initDone:           false,
                    formUrls:           null, // Object with url's to form. Used by opt.getListFormUrl()
                    isStateRequired:    false, // SP defaults are for fields to be optional
                    maxColumnVisible:   10,
                    showNumberOfColumns: 10,    // number of columns shown on the board
                    /**
                     * Populates the opt.states and opt.statesMap by
                     * pulling info. from the List definition
                     *
                     * @return {jQuery.Promise}
                     *      Success, promise get resolved with a scope of 'opt' and
                     *          receives the xData and status variables
                     *      Failure, promise gets resolved with cope of 'ele' and
                     *          received a string with the error, xData and Status.
                     *
                     */
                    getBoardStates: getBoardStates,

                    /**
                     * Retrieves the items from the list for display on the board.
                     * Method return a promise whose input param is an array of
                     * object.
                     *
                     * @param {object} options
                     *
                     * @return {jQuery.Promise} jQuery promise
                     *
                     */
                    _getListItems:   function(){

                        return $.Deferred(function(dfd){

                            /**
                             * Resolves the Deferred object.
                             *
                             * @param {jQuery|Function} rawResponse
                             *              Raw response from teh call to get data.
                             *              is passed along to the user's onGetListItems()
                             *              callback.
                             */
                            function resolveDeferred(rawResponse) {

                                // If a callback was defined for onGetListItems,
                                // then call it now
                                if ($.isFunction(opt.onGetListItems)) {

                                    opt.onGetListItems.call(
                                        ele,
                                        opt.listItems,
                                        rawResponse
                                    );

                                }

                                dfd.resolveWith(ele, [opt.listItems]);

                            } //end: resolveDeferred()

                            // If CAMLQuery is a function, then call user'
                            // data retrieval method.
                            if ($.isFunction( opt.CAMLQuery )) {

                                opt.CAMLQuery.call(
                                    ele,
                                    function(items){

                                        if ($.isArray(items)) {

                                            opt.listItems = items;
                                            resolveDeferred( opt.CAMLQuery );
                                        }

                                    },
                                    options
                                );

                            // ELSE, opt.CAMLQuery is not a function...
                            // call GetListItems operation.
                            } else {

                                getListItems({
                                    listName:       opt.list,
                                    async:          true,
                                    CAMLQuery:      opt.CAMLQuery,
                                    CAMLRowLimit:   0, // FIXME: SP data should be paged??
                                    CAMLViewFields: opt.CAMLViewFields,
                                    webURL:         opt.webURL
                                })
                                .then(function(rows){

                                    opt.listItems   = rows;
                                    resolveDeferred(rows);

                                })//end: completefunc()
                                .fail(function(rows, data, status){

                                     dfd.rejectWith($, [ rows, data, status ]);

                                });

                            } //end: else: get list items

                        }).promise();

                    }, //end: _getListItems()

                    /**
                     * Given an ID, this method will return the data object
                     * for that item - the element retrieved during for
                     * display on the board.
                     *
                     * @param {String|Interger}
                     *
                     * @return {Object} Item Object
                     *
                     */
                    getBoardItemDataObject: function(itemId){

                        var itemObject = null,
                            x,y,id;

                        if (itemId) {

                            itemId = String(itemId);

                            for(x=0,y=opt.listItems.length; x<y; x++){

                                id = opt.listItems[x].ID;

                                if ($.isFunction(id)) {

                                    id = opt.listItems[x].ID();

                                }

                                id = String(id);

                                if (itemId === id) {

                                    itemObject = opt.listItems[x];
                                    x = y + y;

                                }

                            }

                        }

                        return itemObject;

                    }, // end: pageSetup.getBoardItemDataObject


                    /**
                     * Shows the List items on the board.
                     *
                     * @param {Object} [options]
                     *
                     * @param {Array} [options.rows=opt.listItems]
                     *              The rows to display on tehe board. Default
                     *              to list stored in opt.listItems.
                     *
                     * @param {Boolean} [options.refresh=false]
                     *              If true, then items currently on the board
                     *              will not be erased; only new items will be
                     *              added and invalid item will be removed.
                     *
                     * @param {Boolean} [options.doBoardInsert=true]
                     *              When true, the items created will be inserted
                     *              into the board widget. Set to false if doing it
                     *              elsewhere.
                     *
                     * @return {Object} itemsForBoard
                     *              An object with state=string of html for
                     *              insertion into the Board.
                     *
                     */
                    showItemsOnBoard:   function(options){

        // console.time("Board.ShowItemsOnBoard()");


                        var thisOpt         = $.extend({}, {
                                                rows:           opt.listItems,
                                                refresh:        false,
                                                doBoardInsert:  true
                                            }, options),
                            newItems        = [],
                            delItems        = [],
                            chgItems        = [],
                            itemsForBoard   = {}, // each state as the key... string of html as value
                            boardItemCntr   = null,
                            thisRowState    = null,
                            thisRowID       = null,
                            evData          = null,
                            thisListRow     = null,
                            x,y;


                        /**
                         * Creates a new items using the given template
                         * and returns a string of that new items.
                         *
                         * @param {Object} itemDataObj  -   The item's object.
                         * @param {jQUery} $uiELe       -   The UI container.
                         *
                         * @return {String} new item html
                         *
                         */
                        function createNewItem(itemDataObj, $uiEle) {

                            var newItem     = "",
                                itemId      = null,
                                css         = "";

                            // Caller defined a function for item template?
                            if ($.isFunction(opt.template)) {

                                newItem = opt.template.call(
                                            ele, itemDataObj, $uiEle);

                                if (newItem) {

                                    newItem = String(newItem);

                                }


                            // ELSE: Caller did not define function for template
                            } else {

                                newItem = fillTemplate(opt.template, thisListRow );

                            }

                            // If we have a UI element already and a new item was created
                            // insert it directly into the UI element.
                            if ($uiEle !== undefined && newItem !== "") {

                                $uiEle.html(newItem);

                            // Else, we have no UI Element... If the new Item is not
                            // blank, then create a new item for insertion.
                            } else if (newItem !== "") {

                                // Accomodate possible knockout objects
                                itemId = itemDataObj.ID;

                                if ($.isFunction(itemDataObj.ID)) {

                                    itemId = itemDataObj.ID();

                                }

                                // Store this item to be added to the board in bulk
                                if ( itemsForBoard[thisRowState] === undefined ) {

                                    itemsForBoard[thisRowState] = "";

                                }

                                if (opt.initDone && thisOpt.refresh) {

                                    css += " spwidget-temp";

                                }

                                itemsForBoard[thisRowState] +=
                                    '<div class="spwidget-board-state-item ui-state-default ui-corner-all' +
                                    css + '" data-id="' + itemId + '">' + newItem + '</div>';

                            }

                            return newItem;

                        } //end: ------> createNewItem()


                        // If refresh is false, then erase all items
                        // currently in the board
                        if (!thisOpt.refresh) {

                            for(x=0,y=opt.states.length; x<y; x++){

                                opt.states[x].headerTotalEle.html("0");
                                opt.states[x].dataEle.empty();

                            }

                        }


         // console.time("Board.ShowItemsOnBoard().each(rows)");

                        // Populate each row into its respective column
                        for(x=0,y=thisOpt.rows.length; x<y; x++){

                            thisListRow = thisOpt.rows[x];

                            // Get this row's State and ID.
                            // Accomodate possible knockout objects
                            thisRowState = thisListRow[opt.field] || "";
                            thisRowID    = thisListRow.ID;

                            if ($.isFunction(thisRowState)) {

                                thisRowState = thisListRow[opt.field]();

                            }

                            if ($.isFunction(thisRowID)) {

                                thisRowID = thisRowID();

                            }

                            // If this state value is on the board (as a column),
                            // Then proced to build the item into the board.
                            if (opt.statesMap[thisRowState]) {

                                // If not a refresh, then the entire UI is being
                                // rebuilt. We'll be working with Strings.
                                if (thisOpt.refresh === false) {

                                    // if INIT is done (true), then capture this as a new
                                    // item on the board (for events)
                                    if (opt.initDone) {

                                        newItems.push(thisListRow);

                                    }

                                    createNewItem(thisListRow);

                                // ELSE, must be doing a Refresh and these
                                // items could already exist on the board.
                                } else {

                                    // Try to find this row in the board
                                    boardItemCntr = opt.statesCntr
                                            .find( "div[data-id='" + thisRowID + "']" );

                                    // If item was NOT found on the board, then
                                    // we're adding it now.
                                    if ( !boardItemCntr.length ) {

                                        // if INIT is done (true), then capture this as a new
                                        // item on the board (for events)
                                        if (opt.initDone) {

                                            newItems.push(thisListRow);

                                        }

                                        createNewItem(thisListRow);

                                    // Else, item was found on the Board.
                                    } else {

                                        // Add a temporary class to the item, so that we
                                        // know a little later (below) that this is still
                                        // a valid item
                                        boardItemCntr.addClass("spwidget-temp");

                                        // Check if it should be moved to a new STate (column)
                                        if (boardItemCntr.closest("div.spwidget-board-state")
                                                .data("boardstate") !== thisRowState
                                        ) {

                                            boardItemCntr.appendTo(opt.statesMap[thisRowState].dataEle);
                                            chgItems.push(thisListRow);

                                        }

                                        // Refresh the UI for the item with the new data
                                        createNewItem(thisListRow, boardItemCntr);

                                    }

                                } //end: if(): is it refresh?

                            } //end: if(): Does the state appear on the board?

                        } //end: for() - each thisOpt.rows[]

         // console.timeEnd("Board.ShowItemsOnBoard().each(rows)");

                        // should we update the board?
                        if (thisOpt.doBoardInsert) {


         // console.time("Board.ShowItemsOnBoard().InsertIntoDOM");


                            for (x in itemsForBoard) {

                                if ( itemsForBoard.hasOwnProperty(x) && itemsForBoard[x] !== "" ) {

                                    opt.statesMap[x].dataEle.append( itemsForBoard[x] );

                                }

                            }

                            // Add the mouseover hover affect.
                            addHoverEffect(ele.find(".spwidget-board-state-item"));


         // console.timeEnd("Board.ShowItemsOnBoard().InsertIntoDOM");


                        }

                        // If initialization is done and board is being
                        // refreshed, then check to see if any items are
                        // no longer valid
                        if (opt.initDone && thisOpt.refresh) {

                            opt.statesCntr.find("div.spwidget-board-state-item")
                                    .not("div.spwidget-temp").each(function(){

                                        delItems.push(
                                            opt.getBoardItemDataObject( $(this).data("id") )
                                        );

                                        $(this).remove();

                                    })
                                    .end()
                                .removeClass("spwidget-temp");

                        }

                        // If initialization was done already, then
                        // trigger events and refresh jQuery UI widget
                        if (opt.initDone) {

                            // Refresh sortable widget if init was already done
                            opt.statesCntr.find("div.spwidget-board-state")
                                    .sortable("refresh")
                                    .end()
                                .disableSelection();

                            // Get a new event object
                            evData = opt.getEventObject();

                            // Trigger events if init has already been done
                            if (newItems.length) {

                                evData.itemsModified.length = 0;
                                evData.itemsModified.push(newItems);
                                ele.trigger(
                                    "spwidget:boarditemadd",
                                    [ ele, $.extend( {}, evData ) ] );

                            }

                            if (delItems.length) {

                                evData.itemsModified.length = 0;
                                evData.itemsModified.push(delItems);
                                ele.trigger(
                                    "spwidget:boarditemremove",
                                    [ ele, $.extend( {}, evData ) ] );

                            }

                            // Push both updates and removals to the eventObject
                            evData.itemsModified.length = 0;
                            evData.itemsModified.push.apply(evData.itemsModified, newItems);
                            evData.itemsModified.push.apply(evData.itemsModified, delItems);
                            evData.itemsModified.push.apply(evData.itemsModified, chgItems);

                            // Trigger event if anything has changed.
                            if (evData.itemsModified.length) {

                                ele.trigger("spwidget:boardchange", [ ele, evData ]);

                            }

                        }//end: if(): initDone == true

                        // Update the headers and set the board height
                        opt.updBoardHeaders();
                        opt.setBoardColumnHeight();

         // console.timeEnd("Board.ShowItemsOnBoard()");

                        return itemsForBoard;

                    }, //end: opt.showItemsOnBoard()

                    /**
                     * Updates the board headers with the total number of
                     * items under each state column
                     *
                     * @param {options} [options]
                     * @param {String} [options.state=null] The state to be updated
                     *
                     */
                    updBoardHeaders: function(options) {

                        var thisOpt = $.extend({}, {
                                state: null
                            }, options ),
                            x,y;

                        // Specific state
                        if (thisOpt.state) {

                            // FIXME: Need to implement functionality

                        // ALL States
                        } else {

                            for( x=0,y=opt.states.length; x<y; x++ ){

                                opt.states[x].headerTotalEle
                                    .html(
                                        opt.states[x].dataEle.children().length
                                    );

                            }

                        }

                    }, //end: opt.updBoardHeaders()

                    /**
                     * Returns an object with data about the board that can
                     * be used to pass along to events.
                     *
                     * @param {jQuery|HTMLElement} [uiItemEle]
                     *      The board item to initiate the event object from.
                     *
                     * @return {Object}
                     *
                     */
                    getEventObject: function(uiItemEle){

                        if (!uiItemEle) {
                            uiItemEle = opt.statesCntr.find("div.spwidget-board-state-item:first");
                        }
                        uiItemEle = $(uiItemEle);

                        var evObj = {
                                /** @property {Object} evObj.stateTotal A map of state name to total number of items */
                                stateTotals:    {},

                                /** @property {Integer} itemTotal   The total number of items in the board, across all states. */
                                itemTotal: 0,

                                /** @property {String} evObj.currentState   The state name */
                                currentState:   uiItemEle.closest("div.spwidget-board-state")
                                                    .data("boardstate"),

                                /** @property {Object} evObj.itemObj    The individual board item data */
                                itemObj:        ( opt.getBoardItemDataObject( uiItemEle.data("id") ) || {} ),

                                /** @property {Array} evObj.itemsModified   The list of objects representing the modified items */
                                itemsModified: []
                            },
                            x,j;

                        // Build totals
                        for( x=0,j=opt.states.length; x<j; x++ ){

                            evObj.itemTotal += evObj.stateTotals[opt.states[x].name] = Number( opt.states[x].headerTotalEle.text() );

                        }

                        return evObj;

                    }, //end: opt.getEventObject()

                    /**
                     * Returns the url (full url) for the requested form
                     * of the List.
                     *
                     * @param {String} type
                     *          A static string value indicating the type
                     *          of form to return. Valid values include
                     *          'EditForm', 'DisplayForm' and 'NewForm'
                     *
                     * @return {String}
                     *          The url to the list form.
                     *
                     */
                    getListFormUrl: function(type) {

                        type = String(type).toLowerCase();

                        function loadFormCollection() {

                            getListFormCollection({
                                listName:       opt.list,
                                webURL:         opt.webURL,
                                cacheXML:       true,
                                async:          false,
                                completefunc:   function(xData/*, Status*/) {

                                    // Need to check for errors?

                                    $(xData.responseXML)
                                        .find("Form")
                                        .each(function(){

                                            var $thisForm = $(this);

                                            opt.formUrls[ String($thisForm.attr("Type")).toLowerCase() ] =
                                                opt.webURL + "/" + $thisForm.attr("Url");

                                        });


                                } //end: completefunc
                            });

                        } //end: loadFormCollection()


                        if (opt.formUrls === null) {

                            opt.formUrls = {};
                            loadFormCollection();

                        }

                        return ( opt.formUrls[type] || "" );

                    }, // end: opt.getListFormUrl()

                    /**
                     * Handles the setting of visible board columns based on
                     * user input, which shoudl be an array of column names.
                     *
                     * @param {Array|String} colList
                     *      An array of columns names or a static string value
                     *      of 'all'. Column names can be either internal name
                     *      or external.
                     *
                     */
                    setUserDefinedVisibleCol: function (colList){

                        var count   = 0,
                            showAll = false;

                        if (!colList) {

                            return;

                        }

                        // If input is not an array, then exit, unless
                        // it is the keyword 'all'.
                        if (!$.isArray(colList) || !colList.length) {

                            if (!$.isArray(colList) && String(colList).toLowerCase() !== "all") {

                                return;

                            }

                            showAll = true;
                            colList = [];

                        }

                        if (colList.length < 2) {

                            return;

                        }

                        // isValidColumn - checks if a column is valid
                        function isValidColumn(colName) {

                            var response = false;

                            $.each(opt.states, function(i, state){

                                if (state.title === colName || state.name === colName) {

                                    response = true;
                                    return false;

                                }

                            });

                            return response;
                        } //end: function isValidColumn


                        // Validate that at least 2 of the column names are valid.
                        if (!showAll) {

                            count = 0;
                            $.each(colList, function(i, col){

                                if (isValidColumn(col)) {

                                    count++;

                                }

                                // If we validated at least 2 columns, exit. Next loop
                                // will do the job of show/hide if column valid.
                                if (count === 2) {

                                    return false;

                                }

                            });

                        }

                        // Loop through all states and if any of them are
                        // in the list of columns to make visible, ensure they
                        // are visible on the board, else hide it.
                        count = 0;
                        $.each(opt.states, function(i, colDef){

                            if (
                                $.inArray(colDef.title, colList) > -1 ||
                                $.inArray(colDef.name, colList) > -1
                            ) {

                                count++;

                                if (colDef.isVisible === false) {

                                    colDef.isVisible = true;
                                    colDef.dataEle.removeClass(CSS_HIDDEN_CLASS_NAME);
                                    colDef.headerEle.removeClass(CSS_HIDDEN_CLASS_NAME);

                                    //colDef.dataEle.css("display", "");
                                    //colDef.headerEle.css("display", "");

                                }

                            } else {

                                colDef.isVisible = false;
                                colDef.dataEle.addClass(CSS_HIDDEN_CLASS_NAME);
                                colDef.headerEle.addClass(CSS_HIDDEN_CLASS_NAME);

                                //colDef.dataEle.css("display", "none");
                                //colDef.headerEle.css("display", "none");

                            }


                            // if we reached the MAX allowed number
                            // of visible columns, then break loop.
                            if (count >= opt.maxColumnVisible) {

                                return false;

                            }

                        });

                        opt.setBoardColumnClass(count);

                        // Adjust the board columns height
                        opt.setBoardColumnHeight();

                        opt.triggerBoardColumnChangeEvent();

                        return;

                    }, //end: setUserDefinedVisibleCol()

                    /**
                     * Sets the class on the board based on the number
                     * of columns displayed.
                     *
                     * @param {Integer} colCount
                     *      Number of columns. If not defined, then this
                     *      method will loop through opt.states to determine
                     *      what is visible
                     *
                     * @return {Object} opt
                     */
                    setBoardColumnClass: function(colCount) {

                        var $colCntr = opt.headersCntr.add(opt.statesCntr);

                        colCount = parseInt( colCount );

                        if (!colCount || colCount < 2) {

                            colCount = 0;

                            $.each(opt.states, function(i, colDef){

                                if (colDef.isVisible) {

                                    colCount++;

                                }

                            });

                        }

                        if (opt.showNumberOfColumns === colCount) {

                            return opt;

                        }

                        // Add the new class...
                        $colCntr.addClass("spwidget-states-" + colCount);

                        if (opt.showNumberOfColumns) {

                            $colCntr.removeClass(
                                "spwidget-states-" + opt.showNumberOfColumns);

                        }

                        opt.showNumberOfColumns = colCount;

                        return opt;

                    }, //end: opt.setBoardColumnClass()

                    /**
                     * Triggers a spwidget:boardColumnChange event on the board.
                     * This is done only if initiazliation has been done. Called
                     * when there are changes invisibility to the board's columns.
                     */
                    triggerBoardColumnChangeEvent: function() {

                        var columns = [];

                        if (opt.initDone) {

                            $.each(opt.statesMap, function(key,defObj){

                                if (defObj.isVisible){

                                    columns.push(defObj.title);

                                }

                            });

                            opt.ele.trigger(
                                "spwidget:boardColumnChange",
                                [ opt.ele, columns ] );

                        }

                    }, //end: opt.triggerBoardColumnChangeEvent

                    /**
                     * Sets up the button for the Column picker.
                     */
                    setupColumnPicker: function(){

                        var $colCntr    = ele.find(".spwidget-board-column-list-cntr"),
                            $colList    = $colCntr.find("div.spwidget-board-column-list"),
                            $colFooter  = $colCntr.children("div.ui-state-default:last"),
                            Picker      = {
                                $totalCntr:     $colCntr.find("span.spwidget-board-column-total")
                            };


                        /**
                         * SEts the total selected on the picker and returns
                         * that total to the caller.
                         *
                         * @return {Integer}
                         */
                        Picker.setTotalSelected = function(){

                            var total = Picker.getSelected().length;

                            Picker.$totalCntr.html(total);

                            return total;

                        }; //end: Picker.setTotalSelected()

                        /**
                         * Returns a jQuery object with the list of columns
                         * selected by the user (anchors <a>)
                         *
                         * @return {jQuery}
                         */
                        Picker.getSelected = function() {

                            return $colList.find("a.ui-state-highlight");

                        }; //end: Picker.getSelected()

                        /**
                         * Shows a message on the picker
                         *
                         */
                        Picker.showMessage = function(msg) {

                            $('<div class="spwidget-board-msg ui-state-error ui-corner-all">' +
                                    msg + '</div>')
                                .appendTo($colFooter)
                                .fadeOut(8000, function(){
                                    $(this).remove();
                                });

                        };

                        /**
                         * Sets the currently displayed columns on the picker
                         */
                        Picker.setSelected = function() {

                            var $columns    = $colList.find("a");

                            $.each(opt.states, function(i, colDef){

                                var $thisCol = $columns.filter(
                                                "[data-board_col_index='" + i + "']" );

                                if (colDef.isVisible) {

                                    Picker.selectColumn($thisCol, false);

                                } else {

                                    Picker.selectColumn($thisCol, true);

                                }

                            });

                            Picker.setTotalSelected();

                        }; //end: Picker.setSelected()

                        /**
                         * Sets the columns (an <a> anchor) to either
                         * selected or not selected
                         *
                         * @param {HTMLElement} colEle
                         *          Single html element or an array of elements
                         *
                         * @param {Boolean} unSelect
                         *          If true, then the column, regardless of its
                         *          current display setting, will be un-selected.
                         *
                         * @return {HTMLElement} anchor
                         */
                        Picker.selectColumn = function(colEle, unSelect){

                            $(colEle).each(function(){

                                var $a      = $(this),
                                    $icon   = $a.find(".ui-icon");

                                if ($a.hasClass("ui-state-highlight") || unSelect) {

                                    if (unSelect !== false) {

                                        $icon.removeClass("ui-icon-check");
                                        $a.removeClass("ui-state-highlight");

                                    }

                                } else {

                                    $icon.addClass("ui-icon-check");
                                    $a.addClass("ui-state-highlight");

                                }

                            });

                            return colEle;

                        }; //end: Picker.selectColumn()

                        /**
                         * CHanges the board columns and makes only those selected
                         * on the COlumn Picker visible. A set of colunsn (the <a>
                         * element on the picker) can also be given on input, which
                         * will be used as the set to make visible, regardless of
                         * their state on the picker.
                         *
                         * @param {jQuery} $selected
                         *
                         * @return {undefined}
                         */
                        Picker.setVisibleColumns = function($selected){

                            if (!$selected) {

                                $selected = Picker.getSelected();

                            }

                            var colNum = $selected.length;

                            // Apply columns
                            $.each(opt.states, function(i, colDef){

                                if ($selected.filter(
                                            "[data-board_col_index='" + i + "']"
                                        ).length
                                ) {

                                    if (colDef.isVisible === false) {

                                        colDef.isVisible = true;
                                        colDef.dataEle.removeClass(CSS_HIDDEN_CLASS_NAME);
                                        colDef.headerEle.removeClass(CSS_HIDDEN_CLASS_NAME);

                                        //colDef.dataEle.css("display", "");
                                        //colDef.headerEle.css("display", "");

                                    }

                                } else {

                                    colDef.isVisible = false;
                                    colDef.dataEle.addClass(CSS_HIDDEN_CLASS_NAME);
                                    colDef.headerEle.addClass(CSS_HIDDEN_CLASS_NAME);

                                    //colDef.dataEle.css("display", "none");
                                    //colDef.headerEle.css("display", "none");

                                }

                            });

                            opt.setBoardColumnClass(colNum);

                            // Adjust the board columns height
                            opt.setBoardColumnHeight();

                        }; //end: Picker.setVisibleColumns()

                        /**
                         * Given an array of visible column names, this method
                         * will make that set of columns visible.
                         * Columns are first validated to ensure they exist,
                         * and the min/max limits are also honored.
                         *
                         * FIXME: Refactor method Picker.setUserDefinedVisibleCol to use opt.setUserDefinedVisibleCol
                         */
                        Picker.setUserDefinedVisibleCol = function(colList){

                                var count       = 0,
                                    selector    = "";

                                // If input is not an array, then exit, unless
                                // it is the keyword 'all'.
                                if (!$.isArray(colList) || !colList.length) {

                                    if (!$.isArray(colList) && String(colList).toLowerCase() !== "all") {

                                        return;

                                    }

                                    // set all columns visible
                                    colList = [];

                                    $.each(opt.states, function(i,colDef){

                                        colList.push(colDef.title);

                                    });

                                }

                                // Build the jQUery selector for the set of columns
                                // that should be made visible. This selector is used
                                // to get a set of elements (columns) from the Picker
                                // that will then drive which columns are visible.
                                $.each(colList, function(i,columnName){

                                    // loop through the Array of states looking
                                    // for this column. Once found, build the
                                    // jquery selector for it and exit loop
                                    $.each(opt.states, function(i, state){

                                        if (state.title === columnName) {

                                            count++;

                                            if (count > 1) {

                                                selector += ",";

                                            }

                                            selector += "a[data-board_col_name='" +
                                                        state.name + "']";

                                            return false;

                                        }

                                    });

                                    // if we reached the MAX allowed number
                                    // of visible columns, then break loop.
                                    if (count >= opt.maxColumnVisible) {

                                        return false;

                                    }

                                });

                                // if we have at least 2 columns, then make only the
                                // requested set visible
                                if (count >= 2) {

                                    Picker.setVisibleColumns($colList.find(selector));
                                    Picker.triggerEvent();

                                }

                            }; //end: Picker.setUserDefinedVisibleCol() and opt.setUserDefinedVisibleCol()

                        /**
                         * Triggers a spwidget:boardColumnChange event on the board.
                         * This is done only if initiazliation has been done.
                         */
                        Picker.triggerEvent = opt.triggerBoardColumnChangeEvent;

                        // ----------------- [ setup ] ------------------

                        // Setup Picker apply button
                        $colCntr.find("button[name='apply']")
                            .button({
                                label: opt.colPickerApplyLabel,
                                icons: {
                                    secondary: "ui-icon-circle-check"
                                }
                            })
                            .on("click", function(/*ev*/){

                                var $selected   = Picker.getSelected(),
                                    colNum      = $selected.length;

                                // validate
                                if (colNum > opt.maxColumnVisible) {

                                    Picker.showMessage(opt.colPickerMaxColMsg);
                                    return;

                                } else if (colNum < 2) {

                                    Picker.showMessage(opt.colPickerMinColMsg);
                                    return;

                                }

                                // Hide container
                                $colCntr.hide();

                                Picker.setVisibleColumns($selected);
                                Picker.triggerEvent();

                            });

                        // Setup Picker CHECK button
                        $colCntr.find("button[name='check']")
                            .attr("title", opt.colPickerCheckLabel)
                            .button({
                                text: false,
                                icons: {
                                    primary: "ui-icon-radio-off"
                                }
                            })
                            .on("click", function(/*ev*/){

                                var $sel = Picker.getSelected();

                                if ($sel.length) {

                                    Picker.selectColumn($sel, true);

                                } else {

                                    Picker.selectColumn( $colList.find("a") );

                                }

                                Picker.setTotalSelected();

                            });

                        // Setup Picker Close button
                        $colCntr.find("button[name='close']")
                            .attr("title", opt.colPickerCloseLabel)
                            .button({
                                text: false,
                                icons: {
                                    primary: "ui-icon-circle-close"
                                }
                            })
                            .on("click", function(/*ev*/){

                                $colCntr.hide();

                            });

                        // Setup the columns button
                        ele.find("div.spwidget-board-settings")
                            .css("display", "")
                            .find("div.spwidget-board-settings-columns")
                                .each(function(){

                                    var $btn = $(this);

                                    $btn.button({
                                        label: opt.colPickerLabel,
                                        icons: {
                                            secondary: "ui-icon-triangle-1-s"
                                        }
                                    })
                                    .on("click.SPWidgets", function(){

                                        if ($colCntr.is(":visible")) {

                                            $colCntr.hide();

                                        } else {

                                            Picker.setSelected();

                                            $colCntr.show()
                                                .position({
                                                    my: "left top",
                                                    at: "left bottom",
                                                    of: $btn
                                                });

                                        }

                                    });

                                    return false;

                                });

                        // Setup the Column choices in the popup
                        $colList.each(function(){

                                var $cntr   = $(this),
                                    columns = "";

                                $.each(opt.states, function(i,colDef){

                                    columns += '<a href="javascript:" data-board_col_index="' +
                                        i + '" data-board_col_name="' + colDef.name +
                                        '"><span class="ui-icon ui-icon-minus"></span>' +
                                        '<span>' + colDef.title + '</span></a>';

                                });

                                $cntr.html(columns);

                                return false;

                            })
                            .on("click", "a", function(){

                                Picker.selectColumn(this);
                                Picker.setTotalSelected();

                            });

                        // Set the label of the Total
                        $colCntr.find("span.spwidget-board-column-total-label")
                            .html( opt.colPickerTotalLabel );

                    }, //end: opt.setupColumnPicker()

                    /**
                     * Sets the height on the board header and
                     * data columns so that they are all equal.
                     *
                     */
                    setBoardColumnHeight: function() {

                        // Set the height of the headers
                        if (opt.headersCntr.is(":visible")) {

                            makeSameHeight(
                                opt.headersCntr.find("div.spwidget-board-state:visible"),
                                0,
                                'min-height'
                            );

                        }

                        // If user defined a fixed height, then use that on the
                        // card content column and exit.
                        if (opt.height) {

                            opt.statesCntr
                                .find("div.spwidget-board-state:visible")
                                .css({
                                    height:         opt.height,
                                    "min-height":   ""
                                });

                            return;

                        }

                        // Else, set the height of the column area that holds the cards.
                        // We also remove the fixed height from these if set.
                        if (opt.statesCntr.is(":visible")) {

                            makeSameHeight(
                                opt.statesCntr
                                    .find("div.spwidget-board-state:visible")
                                    .css("height", ""),
                                20,
                                'min-height'
                            );

                        }

                        return;

                    }, // end: opt.setBoardCOlumnHeight()

                    /**
                     * Returns an array of objects with the list of board
                     * columns currently defined for the board. This list
                     * is _NOT_ the internal array, but rather an external
                     * "safe" list.
                     *
                     * @return {Array}
                     *      An array of objects. Each object contains the
                     *      name, title and isVisible attributes.
                     *
                     */
                    getBoardColumnList: function() {

                        var columns = [],
                            i,j;

                        for(i=0,j=opt.states.length; i<j; i++){

                            columns.push({
                                name:       opt.states[i].name,
                                title:      opt.states[i].title,
                                isVisible:  opt.states[i].isVisible
                            });

                        }

                        return columns;

                    } //end: opt.getBoardColumnList()


            });//end: $.extend() set opt

            if (!opt.webURL) {
                opt.webURL = getSiteUrl();
            }

            //----------------------------------------------------------
            //----------------[ Initialize this instance ]--------------
            //----------------------------------------------------------

            // Check for Required params
            if ( !opt.list || !opt.field ) {

                ele.html("<div>SPWidgets:Board [ERROR] Missing required input parameters!</div>");
                return this;

            }

            // Store instance object and mark element "loading"
            ele.addClass("loadingSPShowBoard").data("SPShowBoardOptions", opt);

            // get board states from the table definition
            opt.getBoardStates().then(function(){

                // If user did not define CAMLViewFields or the definition
                // by the user did not include the Board column then either
                // define it here or add on to the set.
                if (opt.CAMLViewFields === "") {

                    opt.CAMLViewFields =
                        '<ViewFields>' +
                            '<FieldRef Name="ID" />' +
                            '<FieldRef Name="Title" />' +
                            '<FieldRef Name="' + opt.field + '" />' +
                        '</ViewFields>';

                } else if (opt.CAMLViewFields.indexOf(opt.field) < 0){

                    opt.CAMLViewFields = opt.CAMLViewFields.replace(
                                    /<\/ViewFields\>/i,
                                    '<FieldRef Name="' +
                                        opt.field + '" /></ViewFields>'
                                );

                }

                // Populate the element with the board template
                ele.html($(boardTemplate).filter("div.spwidget-board"));

                // Get a copy of the state column for both headers and values
                opt.tmpltHeader  = $("<div/>")
                                    .append(
                                        ele.find("div.spwidget-board-headers-cntr div.spwidget-board-state").clone()
                                    ).html();

                opt.tmpltState   = $("<div/>")
                                .append(
                                    ele.find("div.spwidget-board-states-cntr div.spwidget-board-state")
                                )
                                .html();

                // Set the number of columns to display
                // If less then 11, then set it to that number
                if (opt.states.length <= opt.maxColumnVisible) {

                    opt.showNumberOfColumns = opt.states.length;

                }

                // Get pointers to the containers in the UI
                opt.statesCntr  = ele
                                    .find("div.spwidget-board-states-cntr")
                                        .addClass(
                                            "spwidget-states-" +
                                            opt.showNumberOfColumns
                                        )
                                        .empty();

                opt.headersCntr = ele
                                    .find("div.spwidget-board-headers-cntr")
                                        .addClass(
                                            "spwidget-states-" +
                                            opt.showNumberOfColumns
                                        )
                                        .empty();

                // Build the board columns
                $.each(opt.states, function(i,v){

                    v.headerEle = $(opt.tmpltHeader)
                                    .appendTo(opt.headersCntr)
                                    .attr("data-boardstate", v.name)
                                    .attr("data-boardindex", i)
                                    .find(".spwidget-board-header-title")
                                        .html(v.title)
                                        .end();

                    v.dataEle = $(opt.tmpltState).appendTo(opt.statesCntr)
                                    .attr("data-boardindex", i)
                                    .attr("data-boardstate", v.name);

                    // Create the header element that holds the total
                    v.headerTotalEle = v.headerEle
                                        .find("span.spwidget-state-item-total");

                    // Create variable to track if column is visible
                    v.isVisible = true;

                    // If the index is greater than 9 (10 columns) then Column
                    // must be hidden - only support 10 columns.
                    if (i > (opt.maxColumnVisible - 1) ) {

                        v.dataEle.addClass(CSS_HIDDEN_CLASS_NAME);
                        v.headerEle.addClass(CSS_HIDDEN_CLASS_NAME);

                        //v.headerEle.css("display", "none");
                        //v.dataEle.css("display", "none");

                        v.isVisible = false;

                    }

                }); //end: .each()

                // Insert element to clear float elements
                $(opt.headersCntr,opt.statesCntr)
                    .append('<div style="clear:both;"></div>');

                // If showColPicker is true, then show the column selector
                if (opt.showColPicker === true) {

                    opt.setupColumnPicker();

                }

                // If user defined colPickerVisible on input, then
                // make only those items visible
                if ($.isArray(opt.colPickerVisible) && opt.colPickerVisible.length) {

                    opt.setUserDefinedVisibleCol(opt.colPickerVisible);

                }

                // Create listeners on the board.
                ele
                    // Bind function to sortable events so that headers stay updated
                    .on("sortreceive sortremove", function(ev, ui){

                        opt.updBoardHeaders();
                        $(ui.item).removeClass("ui-state-hover");

                    })

                    // On Sortreceive: update item
                    .on("sortreceive", function(ev, ui){

                        var evData  = opt.getEventObject(ui.item),
                            dfd     = $.Deferred(),
                            itemId  = '';

                        // Handle possibly the itemObject being a knockout object
                        if ($.isFunction(evData.itemObj.ID)) {

                            itemId = evData.itemObj.ID();

                        } else {

                            itemId = evData.itemObj.ID;

                        }

                        // Make the update to the state in SP
                        evData.updates       = []; // Format = SPService UpdateListItems
                        evData.updatePromise = dfd.promise();
                        evData.updates.push([ opt.field, evData.currentState ]);

                        // TODO: need to normalize evData by adding values to itemsModified

                        // Call any onPreUpdate event. If TRUE (boolean) is returned,
                        // update is canceled. Note that the UI is not updated to
                        // reflect a canceled update (ex. item is not moved back to
                        // original position)
                        if ($.isFunction(opt.onPreUpdate)) {

                            if (opt.onPreUpdate.call(ui.item, ev, ui.item, evData) === true) {

                                return this;

                            }

                        }

                        // If no updates to make, exit here.
                        if (!evData.updates.length) {

                            return this;

                        }

                        // Make update to SP item
                        updateListItems({
                            listName:       opt.list,
                            async:          true,
                            ID:             itemId,
                            valuepairs:     evData.updates,
                            webURL:         opt.webURL,
                            completefunc:   function(xData, status){

                                // Process Errors
                                if (status === "error") {

                                    dfd.rejectWith(
                                            ele,
                                            [ 'Communications Error!', xData, status ]);

                                    return;

                                }

                                var resp = $(xData.responseXML),
                                    row  = null;

                                if ( doesMsgHaveError(resp) ) {

                                     dfd.rejectWith(
                                            ele,
                                            [ getMsgError(resp), xData, status ]);

                                    return;

                                }

                                row = getNodesFromXml({
                                    xDoc: xData.responseXML,
                                    nodeName: "z:row"
                                });

                                $(ev.target).trigger(
                                    "spwidget:boardchange", [ ui.item, evData ] );

                                dfd.resolveWith(ev.target, [row[0], evData.itemObj, xData]);

                            }//end: completefunc()
                        });

                    }) // end: ele.on("sortreceive")

                    // Buind event to catch board actions
                    .on("click", "a.spwidgets-board-action", function(ev){

                        var $actionEle  = $(ev.currentTarget),
                            action      = String(
                                                $actionEle
                                                    .data("spwidgets_board_action")
                                            )
                                            .toLowerCase(),
                            gotoUrl     = "",
                            thisPageUrl = encodeURIComponent(window.location.href);

                        // TODO: enhance to open item in dialog (SP2010) if that feature is on

                        switch (action) {

                            case "edit-item":

                                gotoUrl = opt.getListFormUrl("EditForm");

                                break;

                            case "view-item":

                                gotoUrl = opt.getListFormUrl("DisplayForm");

                                break;


                        } //end: switch()

                        window.location.href = gotoUrl +
                            "?ID=" + $actionEle.data("spwidgets_id") +
                            "&Source=" + thisPageUrl;

                        return this;

                    }); //end: ele.on()

                // If no template was defined, use default
                if (opt.template === null) {

                    // FIXME: need to split the item template into its own HTML file
                    opt.template = $( boardTemplate )
                                    .filter("div.spwidget-item-template");

                }

                // Retrieve the items from the List and then
                // Display items retrieved on the board
                opt._getListItems()
                    .then(function(){

                        opt.showItemsOnBoard();

                        // Make the columns "sortable"
                        opt.statesCntr.find("div.spwidget-board-state").each(function(){
                            var thisState = $(this);
                            thisState.sortable({
                                connectWith:    thisState.siblings(),
                                containment:    ele,
                                cursor:         "move",
                                tolerance:      "pointer",
                                opacity:        ".80",
                                placeholder:    "ui-state-highlight spwidget-board-placeholder",
                                forcePlaceholderSize: true,
                                remove:         function(/*ev, ui*/){

                                    opt.setBoardColumnHeight();

                                }//end: remove()
                            });

                        });


                        // Make text inside the states container un-selectable.
                        opt.statesCntr.disableSelection();

                        opt.initDone = true;

                        opt.setBoardColumnHeight();

                        // remove temp class and add the hasSPShowBoard to it.
                        ele.addClass("hasSPShowBoard").removeClass("loadingSPShowBoard");

                        // Call any user defined callback and trigger create event
                        if ($.isFunction(opt.onBoardCreate)) {

                            opt.onBoardCreate.call(ele, opt.getEventObject());

                        }

                        $(ele).trigger(
                            "spwidget:boardcreate",
                            [ ele, opt.getEventObject() ] );

                    });

            }) //end: .then() (get board states)
            .fail(function(failureMsg/*, xData, status*/){

                ele.append('<div class="ui-state-error"><p>' + failureMsg + '</p></div>');

            }); //end: .fail() (get board states)

            return this;

        });//end: return .each()

        // return the original jQuery selection OR whatever
        // a method might have generated if one was called.
        return retVal;

    }; //end: showBoard()

    /**
     * Returns the board states (columns).
     * @private
     * @this board
     */
    getBoardStates = function(){

        var opt = this;

        return $.Deferred(function(dfd){

            var
            rejectDeferred = function(jqXHR, msg){

                dfd.rejectWith($, [
                    (msg || 'Field (' + opt.field +  ') not found in list definition!'),
                    jqXHR,
                    "error"
                ]);

            };

            // Get list columns from SP
            getListColumns({
                listName:   opt.list,
                cacheXML:   true,
                webURL:     opt.webURL
            })
            .then(function(listCols){

                var f = listCols.getColumn(opt.field);

                if (!f) {
                    rejectDeferred(null);
                    return;
                }

                // Lets make sure that when we deal with the server, we always
                // use the Field's internal name
                opt._origField  = opt.field;
                opt.field       = f.Name;

                // store if field is required
                if (f.Required === "TRUE" ) {
                    opt.isStateRequired = true;
                }

                // Override the calculated required state attribute
                // if user set allowFieldBlanks on input
                if (typeof opt.allowFieldBlanks === "boolean") {
                    opt.isStateRequired = !opt.allowFieldBlanks;
                }

                // Process the column type (choice or Lookup)
                switch(f.Type.toLowerCase()) {
                    // CHOICE COLUMNS
                    case "choice":

                        // Should there be a blank column?
                        if ( !opt.isStateRequired ) {
                            opt.states.push({
                                type:   'choice',
                                title:  opt.optionalLabel,
                                name:   opt.optionalLabel
                            });
                            opt.statesMap[""] = opt.states[opt.states.length - 1];
                        }

                        if (opt.fieldFilter) {
                            opt.fieldFilter = opt.fieldFilter.split(/\,/);
                        }

                        // Loop through the Columns allowed values
                        f.getColumnValues().some(function(colValue, i){

                            // if there is a filter and this column
                            // is not part of it, exit loopnow
                            if (opt.fieldFilter) {

                                if (!$.grep(opt.fieldFilter, function(e){ return (e === colValue); }).length) {
                                    return;
                                }

                            }

                            // If we reached a max column number, exit here.
                            if (i >= Board.maxColumns){

                                try { console.log(
                                        "SPWIDGETS:BOARD:Warning: Can only build a max of " +
                                        Board.maxColumns + " columns!");
                                } catch(e){ }

                                return true; // break the loop

                            }

                            opt.states.push({
                                type:   'choice',
                                title:  colValue, // external visible value
                                name:   colValue  // internal name
                            });

                            // Store State value in mapper (use internal name)
                            opt.statesMap[colValue] = opt.states[opt.states.length - 1];

                        });

                        dfd.resolveWith($, [opt.states]);

                        break;

                    // LOOKUP COLUMNS
                    case "lookup":

                        if ( !opt.fieldFilter ) {
                            opt.fieldFilter = "<Query></Query>";
                        }

                        // Query the lookup table and get the rows that
                        // should be used to build the states
                        getListItems({
                            listName:       f.List,
                            async:          true,
                            cacheXML:       true,
                            CAMLQuery:      opt.fieldFilter,
                            webURL:         opt.webURL,
                            CAMLRowLimit:   Board.maxColumns,
                            CAMLViewFields: '<ViewFields><FieldRef Name="' +
                                            f.ShowField + '" /></ViewFields>'
                        })
                        .then(function(rows){

                            // Process Errors
                            if (status === "error") {
                                rejectDeferred(null, 'Communications Error!');
                                return;
                            }

                            // Should there be a blank column?
                            if ( !opt.isStateRequired ) {

                                opt.states.push({
                                    type:   'lookup',
                                    title:  opt.optionalLabel,  // extenal visible
                                    name:   ""                  // internal name
                                });
                                opt.statesMap[""] = opt.states[opt.states.length - 1];

                            }

                            // Loop through the rows and build the State... break
                            // loop if we go over the max about of columns allowed.
                            rows.some(function(thisRow, i){

                                // If we reached a max column number, exit here.
                                if (i >= Board.maxColumns){

                                    try { console.log(
                                            "SPWIDGETS:BOARD:Warning: Can only build a max of " +
                                            Board.maxColumns + " columns!");
                                    } catch(e){ }
                                    return true;

                                }

                                var
                                thisId      = thisRow.ID,
                                thisTitle   = thisRow[f.ShowField],
                                thisName    = thisId + ";#" + thisTitle;

                                opt.states.push({
                                    type:   'lookup',
                                    title:  thisTitle,  // Extenal visible
                                    name:   thisName    // internal name
                                });

                                // Store State value in mapper (use internal name)
                                opt.statesMap[thisName] = opt.states[opt.states.length - 1];

                            });

                            dfd.resolveWith(opt, [opt.states]);

                            return;

                        })
                        .fail(function(jqXHR){
                            rejectDeferred(jqXHR, 'Unable to get rows from Lookup column list');
                        });

                        break;

                    // DEFAULT: Type on the column is not supported.
                    default:
                        rejectDeferred(
                            null,
                            'Field (' + opt.field + ') Type (' + f.Type +') is not supported!'
                        );

                        break;

                } // end: switch()

                return;

            })
            // getListColumns failed
            .fail(function(jqXHR){
                 rejectDeferred(jqXHR);
            });

        })
        .promise();

    }; //end: getBoardStates()

    showBoard.defaults = Board.defaults;
    return showBoard;

});
