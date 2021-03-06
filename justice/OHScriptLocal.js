// Based on the Wikipedia user script "User:Enterprisey/reply-link.js"
// Study Options -->    000: nothing, 
                    //  001: 'score+prob', 
                    //  010: feedback, 
                    //  011: suggestion, 
                    //  100: 'score+prob'+feedback, 
                    //  101: 'score+prob'+suggestion, 
                    //  110: feedback+suggestion, 
                    //  111: 'score+prob'+feedback+suggestion
//<nowiki>
function loadOptionsforCheck( $, mw ) {
    var TIMESTAMP_REGEX = /\(CEST(?:(?:−|\+)\d+?(?:\.\d+)?)?\)\S*?\s*$/m;           // add new
    // var TIMESTAMP_REGEX = /\(UTC(?:(?:−|\+)\d+?(?:\.\d+)?)?\)\S*?\s*$/m;
    var EDIT_REQ_REGEX = /^((Semi|Template|Extended-confirmed)-p|P)rotected edit request on \d\d? \w+ \d{4}/;
    var EDIT_REQ_TPL_REGEX = /\{\{edit (template|fully|extended|semi)-protected\s*(\|.+?)*\}\}/;
    var LITERAL_SIGNATURE = "~~" + "~~"; // split up because it might get processed
    var PARSOID_ENDPOINT = "https:" + mw.config.get( "wgServer" ) + "/api/rest_v1/page/html/";
    var HEADER_SELECTOR = "h1,h2,h3,h4,h5,h6";
    var Study_group = 0;
    var Testoption = 7;         // should be come from the User API 
    var Click_preview = 0;
    var Tox_level;              // 0: low (<0.35), 1: medium (0.35 to 0.75), 2: high (>0.75)
    var Try_number = 1;         // add new for the study 
    var Ori_String_main = "";        // add new for the study 
    var replied_String = "";
    var Ori_String = "";            // add new for the study 
    var Use_Sugg = 0;               // add new for the study
    var Chng_Comment = 0;           // add new for the study

    currentPageName = mw.config.get( "wgPageName" );
    currentUserName = mw.config.get("wgUserName")

    // Threshold for indentation when we offer to outdent
    var OUTDENT_THRESH = 8;

    // All of the interface message keys that we explicitly load
    var INT_MSG_KEYS = [ "mycontris" ];

    // Date format regexes in signatures (i.e. the "default date format")
    var DATE_FMT_RGX = {
        "//en.wikipedia.org": /\d\d:\d\d,\s\d{1,2}\s\w+?\s\d{4}/.source
    }

    // Shared API object
    var api;

    /*
     * Regex *sources* for a "userspace" link. Basically the
     * localized equivalent of User( talk)?|Special:Contributions/
     * Initialized in buildUserspcLinkRgx, which is called near the top
     * of the closure in handleWrapperClick.
     *
     * Three subproperties: und for underscores instead of spaces (e.g.
     * "User_talk"), spc for spaces (e.g. "User talk"), and both for
     * a regex combining the two (used for matching on wikitext).
     */
    var userspcLinkRgx = null;

    /**
     * This dictionary is some global state that holds three pieces of
     * information for each "(reply)" link (keyed by their unique IDs):
     *
     *  - the indentation string for the comment (e.g. ":*::")
     *  - the header tuple for the parent section, in the form of
     *    [level, text, number], where:
     *      - level is 1 for a h1, 2 for a h2, etc
     *      - text is the text between the equal signs
     *      - number is the zero-based index of the heading from the top
     *  - sigIdx, or the zero-based index of the signature from the top
     *    of the section
     *
     * This dictionary is populated in attachLinks, and unpacked in the
     * click handler for the links (defined in attachLinkAfterNode); the
     * values are then passed to doReply.
     */
    var metadata = {};

    /**
     * This global string flag is:
     *
     *  - "AfD" if the current page is an AfD page
     *  - "MfD" if the current page is an MfD page
     *  - "TfD" if the current page is a TfD log page
     *  - "CfD" if the current page is a CfD log page
     *  - "FfD" if the current page is a FfD log page
     *  - "" otherwise
     *
     * This flag is initialized in onReady and used in attachLinkAfterNode
     */
    var xfdType;

    /**
     * The current page name, including namespace, because we may be reading it
     * a lot (especially in findUsernameInElem if we're on someone's user
     * talk page)
     */
    var currentPageName;

    /**
     * A map for signatures that contain redirects, so that they can still
     * pass the sanity check. This will be updated manually, because I
     * don't want the overhead of a whole 'nother API call in the middle
     * of the reply process. If this map grows too much, though, I'll
     * consider switching to either a toolforge-hosted API or the
     * Wikipedia API. Used in doReply, for the username sanity check.
     */
    var sigRedirectMapping = {
        "Salvidrim": "Salvidrim!"
    };

    /**
     * When the reply is saved via API, this flag is set to true to
     * disable the onbeforeunload handler.
     */
    var replyWasSaved = false;

    /**
     * Cache for getWikitext. Only useful in test mode.
     */
    var getWikitextCache = {};

    // new add : to get the suggestion text
    function selectTextareaLine(tarea,lineNum) {
        lineNum--; // array starts at 0
        var lines = tarea.value.split("\n");
    
        return lines[lineNum];
    }
     // new add : to get the suggestion text

    /**
     * Get the formatted namespace name for a namespace ID.
     * Quick ref: user = 2, proj = 4
     */
    function fmtNs( nsId ) {
        return mw.config.get( "wgFormattedNamespaces" )[ nsId ];
    }

    /**
     * Escapes a string for inclusion in a regex.
     */
    function escapeForRegex( s ) {
        return s.replace( /[-\/\\^$*+?.()|[\]{}]/g, '\\$&' );
    }

    /*
     * MediaWiki turns spaces before certain punctuation marks
     * into non-breaking spaces, so fix those. This is done by
     * the armorFrenchSpaces function in Mediawiki, in the file
     * /includes/parser/Sanitizer.php
     */
    function deArmorFrenchSpaces( text ) {
        return text.replace( /\xA0([?:;!%»›])/g, " $1" );
    }

    /**
     * Capitalize the first letter of a string.
     */
    function capFirstLetter( someString ) {
        return someString.charAt( 0 ).toUpperCase() + someString.slice( 1 );
    }

    /**
     * Namespace name ("Template") to ID (10).
     */
    function nsNameToId( nsName ) {
        return mw.config.get( "wgNamespaceIds" )[ nsName.toLowerCase().replace( / /g, "_" ) ];
    }

    /*  Need this to change markup text to normal text*/
    function wikitextToTextContent( wikitext ) {
        return decodeURIComponent( processCharEntities( wikitext ) )
            .replace( /\[\[:?(?:[^\|\]]+?\|)?([^\]\|]+?)\]\]/g, "$1" )
            .replace( /\{\{\s*tl\s*\|\s*(.+?)\s*\}\}/g, "{{$1}}" )
            .replace( /\{\{\s*[Uu]\s*\|\s*(.+?)\s*\}\}/g, "$1" )
            .replace( /('''?)(.+?)\1/g, "$2" )
            .replace( /<s>(.+?)<\/s>/g, "$1" )
            .replace( /<span.*?>(.*?)<\/span>/g, "$1" );
    }

    /**
     * Canonical-ize a namespace.
     */
    function canonicalizeNs( ns ) {
        return fmtNs( nsNameToId( ns ) );
    }

    /**
     * This function converts any (index-able) iterable into a list.
     */
    function iterableToList( nl ) {
        var len = nl.length;
        var arr = new Array( len );
        for( var i = 0; i < len; i++ ) arr[i] = nl[i];
        return arr;
    }

    /**
     * Decode HTML entities. Used in the signature sanity check.
     * Source: https://stackoverflow.com/a/1912522/1757964
     */
    function htmlDecode( html ) {
        var el = document.createElement( "span" );
        el.innerHTML = html;
        return el.childNodes[0].nodeValue;
    }

    /**
     * Process HTML character entities.
     * From https://stackoverflow.com/a/46851765
     */
    function processCharEntities( text ) {
        var el = document.createElement('div');
        return text.replace( /\&[#0-9a-z]+;/gi, function ( enc ) {
            el.innerHTML = enc;
            return el.innerText
        } );
    }

    /**
     * When there's a panel being shown, this function sets the status
     * in the panel to the first argument. The callback function is
     * optional.
     */
    function setStatus ( status, callback ) {
        var statusElement = $( "#reply-dialog-status" );
        statusElement.fadeOut( function () {
            statusElement.html( status ).fadeIn( callback );
        } );
    }

    /**
     * Sets the panel status when an error happened. Good for use in
     * catch blocks.
     */
    function setStatusError( e ) {
        console.error(e);
        if( e.message ) {
            console.log( "Content request error: " + JSON.stringify( e.message ) );
        }
        console.log( "DEBUG INFORMATION: '"+currentPageName+"' @ " +
                mw.config.get( "wgCurRevisionId" ),"parsoid",PARSOID_ENDPOINT+
                encodeURIComponent(currentPageName).replace(/'/g,"%27")+"/"+mw.config.get("wgCurRevisionId") );
        throw e;
    }

    /**
     * Given some wikitext, processes it to get just the text content.
     * This function should be identical to the MediaWiki function
     * that gets the wikitext between the equal signs and comes up
     * with the id's that anchor the headers.
     */

    /**
     * Finds and returns the div that is the immediate parent of the
     * first talk page header on the page, so that we can read all the
     * sections by iterating through its child nodes.
     */
    function findMainContentEl() {

        // Which header are we looking for?
        var targetHeader = "h2";

        // The element itself will be the text span in the h2; its
        // parent will be the h2; and the parent of the h2 is the
        // content container that we want
        var candidates = document.querySelectorAll( targetHeader + " > span.mw-headline" );
        console.log(candidates.length);
        if( !candidates.length ) return null;
        var candidate = candidates[candidates.length-1].parentElement.parentElement;

        // Compatibility with User:Enterprisey/hover-edit-section
        // That script puts each section in its own div, so we need to
        // go out another level if it's running
        if( candidate.className === "hover-edit-section" ) {
            return candidate.parentElement;
        } else {
            return candidate;
        }
    }

    /**
     * Gets the wikitext of a page with the given title (namespace required).
     * Returns an object with keys "content" and "timestamp".
     */
    function getWikitext( title, useCaching ) {
        if( useCaching === undefined ) useCaching = false;
        if( useCaching && getWikitextCache[ title ] ) {
            return $.when( getWikitextCache[ title ] );
        }
        return $.getJSON(
            mw.util.wikiScript( "api" ),
            {
                format: "json",
                action: "query",
                prop: "revisions",
                rvprop: "content",
                rvslots: "main",
                rvlimit: 1,
                titles: title
            }
        ).then( function ( data ) {
            var pageId = Object.keys( data.query.pages )[0];
            if( data.query.pages[pageId].revisions ) {
                var revObj = data.query.pages[pageId].revisions[0];
                var result = { timestamp: revObj.timestamp, content: revObj.slots.main["*"] };
                getWikitextCache[ title ] = result;
                return result;
            }
            return {};
        } );
    }

    /**
     * Creates userspcLinkRgx. Called in handleWrapperClick and the test
     * runner at the bottom.
     */
    function buildUserspcLinkRgx() {
        var nsIdMap = mw.config.get( "wgNamespaceIds" );
        var nsRgxFragments = [];
        var contribsSecondFrag = ":" + escapeForRegex( mw.messages.get( "mycontris" ) ) + "\\/";
        for( var nsName in nsIdMap ) {
            if( !nsIdMap.hasOwnProperty( nsName ) ) continue;
            switch( nsIdMap[nsName] ) {
                case 2:
                case 3:
                    nsRgxFragments.push( escapeForRegex( capFirstLetter( nsName ) ) + "\\s*:" );
                    break;
                case -1:
                    nsRgxFragments.push( escapeForRegex( capFirstLetter( nsName ) ) + contribsSecondFrag );
                    break;
            }
        }
        userspcLinkRgx = {};
        userspcLinkRgx.spc = "(?:" + nsRgxFragments.join( "|" ).replace( /_/g, " " ) + ")";
        userspcLinkRgx.und = userspcLinkRgx.spc.replace( / /g, "_" );
        userspcLinkRgx.both = "(?:" + userspcLinkRgx.spc + "|" + userspcLinkRgx.und + ")";
    }

    /**
     * Is there a signature (four tildes) present in the given text,
     * outside of a nowiki element?
     */
    function hasSig( text ) {

        // no literal signature?
        if( text.indexOf( LITERAL_SIGNATURE ) < 0 ) return false;

        // if there's a literal signature and no nowiki elements,
        // there must be a real signature
        if( text.indexOf( "<nowiki>" ) < 0 ) return true;

        // Save all nowiki spans
        var nowikiSpanStarts = []; // list of ignored span beginnings
        var nowikiSpanLengths = []; // list of ignored span lengths
        var NOWIKI_RE = /<nowiki>.*?<\/nowiki>/g;
        var spanMatch;
        do {
            spanMatch = NOWIKI_RE.exec( text );
            if( spanMatch ) {
                nowikiSpanStarts.push( spanMatch.index );
                nowikiSpanLengths.push( spanMatch[0].length );
            }
        } while( spanMatch );

        // So that we don't check every ignore span every time
        var nowikiSpanStartIdx = 0;

        var LIT_SIG_RE = new RegExp( LITERAL_SIGNATURE, "g" );
        var sigMatch;

        matchLoop:
        do {
            sigMatch = LIT_SIG_RE.exec( text );
            if( sigMatch ) {

                // Check that we're not inside a nowiki
                for( var nwIdx = nowikiSpanStartIdx; nwIdx <
                    nowikiSpanStarts.length; nwIdx++ ) {
                    if( sigMatch.index > nowikiSpanStarts[nwIdx] ) {
                        if ( sigMatch.index + sigMatch[0].length <=
                            nowikiSpanStarts[nwIdx] + nowikiSpanLengths[nwIdx] ) {

                            // Invalid sig
                            continue matchLoop;
                        } else {

                            // We'll never encounter this span again, since
                            // headers only get later and later in the wikitext
                            nowikiSpanStartIdx = nwIdx;
                        }
                    }
                }

                // We aren't inside a nowiki
                return true;
            }
        } while( sigMatch );
        return false;
    }

    /**
     * Given an Element object, attempt to recover a username from it.
     * Also will check up to two elements prior to the passed element.
     * Returns null if no username was found. Otherwise, returns an
     * object with these properties:
     *
     *  - username: The username that we found.
     *  - link: The DOM object for the link from which we got the
     *    username.
     */
    function findUsernameInElem( el ) {
        if( !el ) return null;
        var links;
        for( let i = 0; i < 3; i++ ) {
            if( el === null ) break;
            links = el.tagName.toLowerCase() === "a" ? [ el ]
                : el.querySelectorAll( "a" );
            //console.log(i,"top of outer for in findUsernameInElem ",el, " links -> ",links);

            // Compatibility with "Comments in Local Time"
            if( el.className.indexOf( "localcomments" ) >= 0 ) i--;

            // If we couldn't get any links, try again with prev elem
            if( !links ) continue;

            var link; // his name isn't zelda
            for( var j = 0; j < links.length; j++ ) {
                link = links[j];

                //console.log(link,decodeURIComponent(link.getAttribute("href")));
                if( link.className.indexOf( "mw-selflink" ) >= 0 ) {
                    return { username: currentPageName.replace( /.+:/, "" )
                        .replace( /_/g, " " ), link: link };
                }

                // Also matches redlinks. Why people have redlinks in their sigs on
                // purpose, I may never know.
                //console.log( "^\\/(?:wiki\\/" + userspcLinkRgx.und + /(.+?)(?:\/.+?)?(?:#.+)?|w\/index\.php\?title=User(?:_talk)?:(.+?)&action=edit&redlink=1/.source + ")$" )
                var sigLinkRe = new RegExp( "^\\/(?:wiki\\/" + userspcLinkRgx.und + /(.+?)(?:\/.+?)?(?:#.+)?|w\/index\.php\?title=/.source + userspcLinkRgx.und + /(.+?)&action=edit&redlink=1/.source + ")$" );
                var usernameMatch = sigLinkRe.exec( decodeURIComponent( link.getAttribute( "href" ) ) );
                if( usernameMatch ) {
                //console.log("usernameMatch",usernameMatch)
                    var rawUsername = usernameMatch[1] ? usernameMatch[1] : usernameMatch[2];
                    return {
                        username: decodeURIComponent( rawUsername ).replace( /_/g, " " ),
                        link: link 
                    };
                }
            }

            // Go backwards one element and try again
            el = el.previousElementSibling;
        }
        return null;
    }

    /**
     * Given a reply-link-wrapper span, attempts to find who wrote
     * the comment that precedes it. For information about the return
     * value, see the documentation for findUsernameInElem.
     */
    function getCommentAuthor( wrapper ) {
        var sigNode = wrapper.previousSibling;
        //console.log(sigNode,sigNode.style,sigNode.style ? sigNode.style.getPropertyValue("size"):"");
        var smallOrFake = sigNode.nodeType === 1 &&
                ( sigNode.tagName.toLowerCase() === "small" ||
                ( sigNode.tagName.toLowerCase() === "span" &&
                    sigNode.style && sigNode.style.getPropertyValue( "font-size" ) === "85%" ) );

        var possUserLinkElem = ( smallOrFake && sigNode.children.length > 1 )
            ? sigNode.children[sigNode.children.length-1]
            : sigNode.previousElementSibling;
        return findUsernameInElem( possUserLinkElem );
    }

    /**
     * Given the wikitext of a section, attempt to find the first edit
     * request template in it, and then mark that template as answered.
     * Returns the modified section wikitext.
     */
    function markEditReqAnswered( sectionWikitext ) {
        var editReqMatch = EDIT_REQ_TPL_REGEX.exec( sectionWikitext );
        if( !editReqMatch ) {
            console.error( "Couldn't find an edit request!" );
            return sectionWikitext;
        }

        var ansParamMatch = /ans(wered)?=.*?(\||\}\})/.exec( editReqMatch[0] );
        if( !ansParamMatch ) {
            sectionWikitext = sectionWikitext.replace(
                editReqMatch[0],
                editReqMatch[0].replace( "}}", "answered=yes}}" )
            );
        } else {
            var newEditReqTpl = editReqMatch[0].replace( ansParamMatch[0],
                "answered=yes" + ansParamMatch[2] );
            sectionWikitext = sectionWikitext.replace(
                editReqMatch[0],
                newEditReqTpl
            );
        }
        return sectionWikitext;
    }

    /**
     * Ascend until dd or li, or a p directly under div.mw-parser-output.
     * live is true if we're on the live DOM (and thus we have our own UI
     * elements to deal with) and false if we're on the psd DOM.
     */
    function ascendToCommentContainer( startNode, live, recordPath ) {
        var currNode = startNode;
        if( recordPath === undefined ) recordPath = false;
        var path = [];
        var lcTag;
        function isActualContainer( node, nodeLcTag ) {
            if( nodeLcTag === undefined ) nodeLcTag = node.tagName.toLowerCase();
            return /dd|li/.test( nodeLcTag ) ||
                    ( ( nodeLcTag === "p" || nodeLcTag === "div" ) &&
                        ( node.parentNode.className === "mw-parser-output" ||
                            node.parentNode.className === "hover-edit-section" ||
                            ( node.parentNode.tagName.toLowerCase() === "section" &&
                                node.parentNode.dataset.mwSectionId ) ) );
        }
        var smallContainerNodeLimit = live ? 3 : 1;
        do {
            currNode = currNode.parentNode;
            lcTag = currNode.tagName.toLowerCase();
            if( lcTag === "html" ) {
                console.error( "ascendToCommentContainer reached root" );
                break;
            }
            if( recordPath ) path.unshift( currNode );
            //console.log( "checking isActualContainer for ", currNode, isActualContainer( currNode, lcTag ),
            //        lcTag === "small", isActualContainer( currNode.parentNode ),
            //            currNode.parentNode.childNodes,
            //            currNode.parentNode.childNodes.length );
        } while( !isActualContainer( currNode, lcTag ) &&
            !( lcTag === "small" && isActualContainer( currNode.parentNode ) &&
                currNode.parentNode.childNodes.length <= smallContainerNodeLimit ) );
        //console.log("ascendToCommentContainer from ",startNode," terminating, r.v. ",recordPath?path:currNode);
        return recordPath ? path : currNode;
    }

    /**
     * Given a Parsoid DOM and a link in the live DOM that is the link at the
     * end of a signature, return the corresponding element in the Parsoid DOM
     * that represents the same comment.
     *
     * psd = Parsoid, live = in the current, live page DOM.
     */
    function getCorrCmt( psdDom, sigLinkElem ) {

        // First, define some helper functions
        
        // Does this node have a timestamp in it?
        function hasTimestamp( node ) {
            //console.log ("hasTimestamp ",node, node.nodeType === 3,node.textContent.trim(),
            //            TIMESTAMP_REGEX.test( node.textContent.trim() ),
            //        node.childNodes.length === 1,
            //            node.childNodes.length && TIMESTAMP_REGEX.test( node.childNodes[0].textContent.trim()),
            //        " => ",( node.nodeType === 3 &&
            //                TIMESTAMP_REGEX.test( node.textContent.trim() ) ) ||
            //           ( node.childNodes.length === 1 &&
            //                TIMESTAMP_REGEX.test( node.childNodes[0].textContent.trim() ) ) );
            //console.log(node,node.textContent.trim(),TIMESTAMP_REGEX.test(node.textContent.trim()));
            var validTag = node.nodeType === 3 || ( node.nodeType === 1 &&
                            ( node.tagName.toLowerCase() === "small" ||
                                node.tagName.toLowerCase() === "span" ) );
            return ( validTag && TIMESTAMP_REGEX.test( node.textContent.trim() ) ||
                   ( node.childNodes.length === 1 &&
                        TIMESTAMP_REGEX.test( node.childNodes[0].textContent.trim() ) ) );
        }

        // Get prefix that's the actual comment
        function getPrefixComment( theNodes ) {
            var prefix = [];
            for( var j = 0; j < theNodes.length; j++ ) {
                prefix.push( theNodes[j] );
                if( hasTimestamp( theNodes[j] ) ) break;
            }
            return prefix;
        }

        /**
         * From a "container elem" (like the whole dd, li, or p that has a
         * comment), get the prefix that ends in a timestamp (because other
         * comments might be after the timestamp), and return the text content.
         */
        function surrTextContentFromElem( elem ) {
            var surrListElemNodes = elem.childNodes;

            // nodeType 8 is for comments
            return getPrefixComment( surrListElemNodes )
                    .map( function ( c ) { return ( c.nodeType !== 8 ) ? c.textContent : ""; } )
                    .join( "" ).trim();
        }

        /** From a "container elem" (dd, li, or p), remove all but the first comment. */
        function onlyFirstComment( container ) {
            //console.log("onlyFirstComment top container and container.childNodes",container,container.childNodes);
            if( container.childNodes.length === 1 && container.children[0].tagName.toLowerCase() === "small" ) {
                console.log( "[onlyFirstComment] container only had a small in it" );
                container = container.children[0];
            }
            var i, autosignedIdx, autosigned = container.querySelector( "small.autosigned" );
            if( autosigned && ( autosignedIdx = iterableToList(
                    container.childNodes ).indexOf( autosigned ) ) >= 0 ) {
                i = autosignedIdx;
            } else {
                var childNodes = container.childNodes;
                for( i = 0; i < childNodes.length; i++ ) {
                    if( hasTimestamp( childNodes[i] ) ) {
                        //console.log( "[oFC] found a timestamp in ",childNodes[i]);
                        break;
                    }
                }
                if( i === childNodes.length ) {
                    throw new Error( "[onlyFirstComment] No timestamp found" );
                }
            }
            //console.log("[onlyFirstComment] killing all after ",i,container.childNodes[i]);
            i++;
            var elemToRemove;
            while( elemToRemove = container.childNodes[i] ) {
                container.removeChild( elemToRemove );
            }
        }

        // End helper functions, begin actual code

        // We dump this object for debugging in the event of an error
        var corrCmtDebug = {};

        // Convert live href to psd href
        var newHref, liveHref = decodeURIComponent( sigLinkElem.getAttribute( "href" ) );
        corrCmtDebug.liveHref = liveHref;
        if( sigLinkElem.className.indexOf( "mw-selflink" ) >= 0 ) {
            newHref = "./" + currentPageName; 
        } else {
            if( /^\/wiki/.test( liveHref ) ) {
                var hrefTokens = liveHref.split( ":" );
                if( hrefTokens.length !== 2 ) throw new Error( "Malformed href" );
                newHref = "./" + canonicalizeNs( hrefTokens[0].replace(
                        /^\/wiki\//, "" ) ).replace( / /g, "_" ) + ":" +
                        encodeURIComponent( hrefTokens[1] )
                            .replace( /^Contributions%2F/, "Contributions/" )
                            .replace( /%2F/g, "/" )
                            .replace( /%23/g, "#" )
                            .replace( /%26/g, "&" )
                            .replace( /%3D/g, "=" )
                            .replace( /%2C/g, "," );
            } else {
                var REDLINK_HREF_RGX = /^\/w\/index\.php\?title=(.+?)&action=edit&redlink=1$/;
                newHref = "./" + REDLINK_HREF_RGX.exec( liveHref )[1];
            }
        }
        var livePath = ascendToCommentContainer( sigLinkElem, /* live */ true, /* recordPath */ true );
        corrCmtDebug.newHref = newHref; corrCmtDebug.livePath = livePath;

        // Deal with the case where the comment has multiple links to
        // sigLinkElem's href; we will store the index of the link we want.
        // null means there aren't multiple links.
        var liveDupeLinks = livePath[0].querySelectorAll( "a" +
                ( liveHref ? ( "[href='" + liveHref + "']" ) : ".mw-selflink" ) );
        if( !liveDupeLinks ) throw new Error( "Couldn't select live dupe link" );
        var liveDupeLinkIdx = ( liveDupeLinks.length > 1 )
                ? iterableToList( liveDupeLinks ).indexOf( sigLinkElem ) : null;
        //console.log("liveDupeLinkIdx",liveDupeLinkIdx);

        //console.log("livePath[0]",livePath[0],livePath[0].childNodes);
        var liveClone = livePath[0].cloneNode( /* deep */ true );
        
        // Remove our own UI elements
        var ourUiSelector = ".reply-link-wrapper,#reply-link-panel";
        iterableToList( liveClone.querySelectorAll( ourUiSelector ) ).forEach( function ( n ) {
            n.parentNode.removeChild( n );
        } );

        //console.log("(BEFORE) liveClone",liveClone,liveClone.childNodes);
        onlyFirstComment( liveClone );
        //console.log("(AFTER) liveClone",liveClone,liveClone.childNodes);

        // Process it a bit to make it look a bit more like the Parsoid output
        var liveAutoNumberedLinks = liveClone.querySelectorAll( "a.external.autonumber" );
        for( var i = 0; i < liveAutoNumberedLinks.length; i++ ) {
            liveAutoNumberedLinks[i].textContent = "";
        }
        var liveSelflinks = liveClone.querySelectorAll( "a.mw-selflink.selflink" );
        for( var i = 0; i < liveSelflinks.length; i++ ) {
            liveSelflinks[i].href = "/wiki/" + currentPageName;
        }

        // "Comments in Local Time" compatibility: the text content is
        // gonna contain the modified time stamp, but the original time
        // stamp is still there
        var localCommentsSpan = liveClone.querySelector( "span.localcomments" );
        if( localCommentsSpan ) {
            var dateNode = document.createTextNode( localCommentsSpan.getAttribute( "title" ) );
            localCommentsSpan.parentNode.replaceChild( dateNode, localCommentsSpan );
        }

        // TODO: Optimization - surrTextContentFromElem does the prefixing
        // operation a second time, even though we already called onlyFirstComment
        // on it.
        var liveTextContent = surrTextContentFromElem( liveClone );
        console.log("liveTextContent >>>>>"+liveTextContent + "<<<<<");

        function normalizeTextContent( tc ) {
            return deArmorFrenchSpaces( tc );
        }

        liveTextContent = normalizeTextContent( liveTextContent );

        var selector = livePath.map( function ( node ) {
            return node.tagName.toLowerCase();
        } ).join( " " ) + " a[href^='" + newHref + "']";

        // TODO: Optimization opportunity - run querySelectorAll only on the
        // section that we know contains the comment
        var psdLinks = iterableToList( psdDom.querySelectorAll( selector ) );
        console.log("(",liveDupeLinkIdx, ")",selector, " --> ", psdLinks);

        var oldPsdLinks = psdLinks,
            newHrefLen = newHref.length,
            hrefSubstr;
        psdLinks = [];
        for( var i = 0; i < oldPsdLinks.length; i++ ) {
            hrefSubstr = oldPsdLinks[i].getAttribute( "href" ).substring( newHrefLen );
            if( !hrefSubstr || hrefSubstr.indexOf( "#" ) === 0 ) {
                psdLinks.push( oldPsdLinks[i] );
            }
        }

        // Narrow down by entire textContent of list element
        var psdCorrLinks = []; // the corresponding link elem(s)
        if( liveDupeLinkIdx === null ) {
            for( var i = 0; i < psdLinks.length; i++ ) {
                var psdContainer = ascendToCommentContainer( psdLinks[i], /* live */ false, true );
                //console.log("psdContainer",psdContainer);
                var psdTextContent = normalizeTextContent( surrTextContentFromElem( psdContainer[0] ) );
                //console.log(i,">>>"+psdTextContent+"<<<");
                if( psdTextContent === liveTextContent ) {
                    psdCorrLinks.push( psdLinks[i] );
                } /* else {
                    //console.log(i,"len: psd live",psdTextContent.length,liveTextContent.length);
                    for(var j = 0; j < Math.min(psdTextContent.length, liveTextContent.length); j++) {
                        if(psdTextContent.charAt(j)!==liveTextContent.charAt(j)) {
                            //console.log(i,j,"psd live", psdTextContent.codePointAt(j), liveTextContent.codePointAt( j ) );
                            break;
                        }
                    }
                } */
            }
        } else {
            for( var i = 0; i < psdLinks.length; i++ ) {
                var psdContainer = ascendToCommentContainer( psdLinks[i], /* live */ false );
                if( psdContainer.dataset.replyLinkGeCorrCo ) continue;
                var psdTextContent = normalizeTextContent( surrTextContentFromElem( psdContainer ) );
                console.log(i,">>>"+psdTextContent+"<<<");
                if( psdTextContent === liveTextContent ) {
                    var psdDupeLinks = psdContainer.querySelectorAll( "a[href='" + newHref + "']" );
                    psdCorrLinks.push( psdDupeLinks[ liveDupeLinkIdx ] );
                }

                // Flag to ensure we don't take a link from this container again
                psdContainer.dataset.replyLinkGeCorrCo = true;
            }
        }

        if( psdCorrLinks.length === 0 ) {
            throw new Error( "Failed to find a matching comment in the Parsoid DOM." );
        } else if( psdCorrLinks.length > 1 ) {
            throw new Error( "Found multiple matching comments in the Parsoid DOM." );
        }

        return psdCorrLinks[0];
    }

    /**
     * Given the Parsoid output (GET /page/html endpoint) on the current
     * page and a DOM object in the current page corresponding to a
     * link in a signature, locate the section containing that
     * comment. That section may not be in the current page! Returns an
     * object with four properties:
     *
     *  - page: The full title of the page directly containing the
     *    comment (in its wikitext, not through transclusion).
     *  - sectionIdx: The anticipated wikitext section index containing
     *    the comment. That is, our best guess as to what the section
     *    index (in the wikitext, using ==wikitext headers==) will be,
     *    ignoring all of the wikitext headers that don't actually
     *    generate header elements (e.g. those inside nowikis, code
     *    blocks, etc).
     *  - sectionName: The anticipated wikitext section name. Should
     *    appear inside the equal signs at the above index.
     *  - sectionLevel: The anticipated wikitext section level (e.g.
     *    2 for an h2)
     *
     * Parsoid is abbreviated here as "psd" in variables and comments.
     */
    function findSection( psdDomString, sigLinkElem ) {

        //console.log(psdDomString);

        var domParser = new DOMParser(),
            psdDom = domParser.parseFromString( psdDomString, "text/html" );

        var corrLink = getCorrCmt( psdDom, sigLinkElem );
        //console.log("STEP 1 SUCCESS",corrLink);

        var corrCmt = ascendToCommentContainer( corrLink, /* live */ false );

        // Ascend until we hit something in a transclusion
        var currNode = corrLink;
        var tsclnId = null;
        do {
            if( currNode.getAttribute( "about" ) &&
                    currNode.getAttribute( "about" ).indexOf( "#mwt" ) === 0 ) {
                tsclnId = currNode.getAttribute( "about" );
                break;
            }
            currNode = currNode.parentNode;
        } while( currNode.tagName.toLowerCase() !== "html" );
        //console.log( "tsclnId", tsclnId );

        // Now, get the nearest header above us
        function inPseudo( headerElement ) {
            var currNodeIP = headerElement;
            // This requires Parsoid HTML v 2.0.0
            do {
                if( currNodeIP.nodeType === 1 && currNodeIP.matches( "section" ) ) {
                    return currNodeIP.dataset.mwSectionId < 0;
                    break;
                }
                currNodeIP = currNodeIP.parentNode;
            } while( currNodeIP );
            return false;
        }

        var currNode = corrCmt;
        var nearestHeader = null;
        var HTML_HEADER_RGX = /^h\d$/;
        do {
            if( HTML_HEADER_RGX.exec( currNode.tagName.toLowerCase() ) ) {
                if( !inPseudo( currNode ) ) {
                    nearestHeader = currNode;
                    break;
                }
            }
            var containedHeaders = currNode.querySelectorAll( HEADER_SELECTOR );
            if( containedHeaders.length ) {
                var nearestHdrIdx = containedHeaders.length - 1;
                while( nearestHdrIdx >= 0 && inPseudo( containedHeaders[ nearestHdrIdx ] ) ) {
                    nearestHdrIdx--;
                }
                if( nearestHdrIdx >= 0 ) {
                    nearestHeader = containedHeaders[ nearestHdrIdx ];
                    break;
                }
            }
            if( currNode.previousElementSibling ) {
                currNode = currNode.previousElementSibling;
                continue;
            }
            currNode = currNode.parentNode;
        } while( currNode.tagName.toLowerCase() !== "body" );

        // Get the target page (page actually containing the comment)
        var targetPage;
        if( tsclnId !== null ) {
            var tsclnInfoSel = "*[about='" + tsclnId + "'][typeof='mw:Transclusion']",
                infoJson = JSON.parse( psdDom.querySelector( tsclnInfoSel ) .dataset.mw );
            //console.log(infoJson);
            for( var i = 0; i < infoJson.parts.length; i++ ) {
                if( infoJson.parts[i].template &&
                        infoJson.parts[i].template.target ) {
                    var wtTarget =infoJson.parts[i].template.target.wt;
                    if( wtTarget && ( wtTarget.indexOf( ":" ) >= 0 || wtTarget.indexOf( "/" ) === 0 ) ) {
                        targetPage = infoJson.parts[i].template.target.wt;
                    }
                }
            }
        }
        if( targetPage && targetPage.charAt( 0 ) === "/" ) {

            // Given relative to the current page
            targetPage = currentPageName + targetPage;
        } else if( !targetPage ) {
            if( tsclnId !== null ) tsclnId = null;
            targetPage = currentPageName;
        }

        // Finally, get the index of our nearest header
        var allHeaders = iterableToList( psdDom.querySelectorAll( HEADER_SELECTOR ) );
        var headerIdx = null, headerAbout;
        var tIdx = 0; // "header index for headers inside tsclnId"

        // Note that i is incremented at the end of the loop because
        // sometimes we want to skip an index, such as when it comes
        // from another template
        for( var i = 0; i < allHeaders.length; ) {
            if( allHeaders[i] === nearestHeader ) {
                headerIdx = tIdx;
                break;
            }
            headerAbout = allHeaders[i].getAttribute( "about" );
            if( allHeaders[i].hasAttribute( "about" ) ) {
                if( headerAbout === tsclnId ) {
                    tIdx++;
                }
                i++;
                continue;
            } else {
                var currNode = allHeaders[i];
                var container = null, containerAbout = null;
                while( currNode.tagName.toLowerCase() !== "body" ) {
                    if( currNode.hasAttribute( "about" ) ) {
                        container = currNode;
                        containerAbout = currNode.getAttribute( "about" );
                        break;
                    }
                    currNode = currNode.parentNode;
                }

                if( container ) {
                    function hasDiscussionPage( dataMw ) {
                        dataMw = JSON.parse( dataMw );
                        if( dataMw.parts && dataMw.parts.length ) {
                            return dataMw.parts.some( function ( part ) {
                                if( part.template && part.template.target && part.template.target.href ) {
                                    var href = part.template.target.href,
                                        nsName = ( href.indexOf( ":" ) < 0 ) ? "" : href.substring( 2, href.indexOf( ":" ) ),
                                        nsId = nsNameToId( nsName );
                                    if( nsId === 10 ) {
                                        return part.template.target.href.indexOf( "./Template:Did you know nominations" ) === 0;
                                    } else {
                                        return nsId % 2 === 1;
                                    }
                                }
                            } );
                        }
                        return false;
                    }

                    // If the container has any other transcluded non-templates inside it,
                    // we can't use it, so treat this header normally and move on
                    var innerTransclusions = container.querySelectorAll( "*[typeof='mw:Transclusion']" );
                    if( innerTransclusions.length ) {
                        var transcludesNonTemplate = iterableToList(
                                innerTransclusions ).any( function ( transclusion ) {
                                    return hasDiscussionPage( transclusion.dataset.mw );
                                } );
                        if( !transcludesNonTemplate && containerAbout === tsclnId ) {
                            tIdx++;
                        }
                        i++;
                        continue;
                    }

                    var containerHeaders = iterableToList( container.querySelectorAll( HEADER_SELECTOR ) );
                    if( container.contains( nearestHeader ) ) {
                        headerIdx = tIdx + containerHeaders.indexOf( nearestHeader );
                        break;
                    } else {
                        if( containerAbout === tsclnId ||
                                ( tsclnId === null && container.dataset.mw && !hasDiscussionPage( container.dataset.mw ) ) ) {
                            tIdx += containerHeaders.length;
                        }
                        i += containerHeaders.length;
                        continue;
                    }
                } else {
                    if( tsclnId === null ) {
                        tIdx++;
                    }
                    i++;
                    continue;
                }
            }
            i++;
        }
        //console.log("headerIdx ",headerIdx);

        var result = {
            page: targetPage,
            sectionIdx: headerIdx,
            sectionName: nearestHeader.textContent,
            sectionLevel: nearestHeader.tagName.substring( 1 )
        };
        return result;
    }

    /**
     * Given some wikitext that's split into sections, return the full
     * wikitext (including header and newlines until the next header)
     * of the section with the given (zero-based) index. To get the content
     * before the first header, sectionIdx should be -1 and sectionName
     * should be null.
     *
     * Performs a sanity check with the given section name.
     */
    function getSectionWikitext( wikitext, sectionIdx, sectionName ) {
        var HEADER_RE = /^\s*=(=*)\s*(.+?)\s*\1=\s*$/gm;

        console.log("In getSectionWikitext, sectionIdx = " + sectionIdx + ", sectionName = >" + sectionName + "<");
        //console.log("wikitext (first 1000 chars) is " + dirtyWikitext.substring(0, 1000));

        // There are certain locations where a header may appear in the
        // wikitext, but will not be present in the HTML; such as code
        // blocks or comments. So we keep track of those ranges
        // and ignore headings inside those.
        var ignoreSpanStarts = []; // list of ignored span beginnings
        var ignoreSpanLengths = []; // list of ignored span lengths
        var IGNORE_RE = /(<pre>[\s\S]+?<\/pre>)|(<source.+?>[\s\S]+?<\/source>)|(<!--[\s\S]+?-->)/g;
        var ignoreSpanMatch;
        do {
            ignoreSpanMatch = IGNORE_RE.exec( wikitext );
            if( ignoreSpanMatch ) {
                //console.log("ignoreSpan ",ignoreSpanStarts.length," = ",ignoreSpanMatch);
                ignoreSpanStarts.push( ignoreSpanMatch.index );
                ignoreSpanLengths.push( ignoreSpanMatch[0].length );
            }
        } while( ignoreSpanMatch );

        var startIdx = -1; // wikitext index of section start
        var endIdx = -1; // wikitext index of section end

        var headerCounter = 0;
        var headerMatch;

        // The section before the first heading starts at idx 0
        if( sectionIdx === -1 ) {
            startIdx = 0;
        }

        // So that we don't check every ignore span every time
        var ignoreSpanStartIdx = 0;

        headerMatchLoop:
        do {
            headerMatch = HEADER_RE.exec( wikitext );
            if( headerMatch ) {

                // Check that we're not inside one of the "ignore" spans
                for( var igIdx = ignoreSpanStartIdx; igIdx <
                    ignoreSpanStarts.length; igIdx++ ) {
                    if( headerMatch.index > ignoreSpanStarts[igIdx] ) {
                        if ( headerMatch.index + headerMatch[0].length <=
                            ignoreSpanStarts[igIdx] + ignoreSpanLengths[igIdx] ) {

                            console.log("(IGNORED, igIdx="+igIdx+") Header " + headerCounter + " (idx " + headerMatch.index + "): >" + headerMatch[0].trim() + "<");

                            // Invalid header
                            continue headerMatchLoop;
                        } else {

                            // We'll never encounter this span again, since
                            // headers only get later and later in the wikitext
                            ignoreSpanStartIdx = igIdx;
                        }
                    }
                }

                //console.log("Header " + headerCounter + " (idx " + headerMatch.index + "): >" + headerMatch[0].trim() + "<");
                if( headerCounter === sectionIdx ) {
                    var sanitizedWktxtSectionName = wikitextToTextContent( headerMatch[2] );

                    sectionName = deArmorFrenchSpaces( sectionName );

                    if( sanitizedWktxtSectionName !== sectionName ) {
                        throw new Error( "Sanity check on header name failed! Found \"" +
                                sanitizedWktxtSectionName + "\", expected \"" +
                                sectionName + "\" (wikitext vs DOM)" );
                    }
                    startIdx = headerMatch.index;
                } else if( headerCounter - 1 === sectionIdx ) {
                    endIdx = headerMatch.index;
                    break;
                }
            }
            headerCounter++;
        } while( headerMatch );

        if( startIdx < 0 ) {
            throw( "Could not find section named \"" + sectionName +
                    "\" at section idx " + sectionIdx );
        }

        // If we encountered no section after the target section,
        // then the target was the last one and the slice will go
        // until the end of wikitext
        if( endIdx < 0 ) {
            //console.log("[getSectionWikitext] endIdx negative, setting to " + wikitext.length);
            endIdx = wikitext.length;
        }

        //console.log("[getSectionWikitext] Slicing from " + startIdx + " to " + endIdx);
        return wikitext.slice( startIdx, endIdx );
    }

    /**
     * Converts a signature index to a string index into the given
     * section wikitext. For example, if sigIdx is 1, then this function
     * will return the index in sectionWikitext pointing to right
     * after the second signature appearing in sectionWikitext.
     *
     * Returns -1 if we couldn't find anything.
     */
    function sigIdxToStrIdx( sectionWikitext, sigIdx ) {
        console.log( "In sigIdxToStrIdx, sigIdx = " + sigIdx );

        // There are certain regions that we skip while attaching links:
        //
        //  - Spans with the class delsort-notice
        //  - Divs with the class xfd-relist (and other divs)
        //
        // So, we grab the corresponding wikitext regions with regexes,
        // and store each region's start index in spanStartIndices, and
        // each region's length in spanLengths. Then, whenever we find a
        // signature with the right index, if it's included in one of
        // these regions, we skip it and move on.
        var spanStartIndices = [];
        var spanLengths = [];
        var DELSORT_SPAN_RE_TXT = /<small class="delsort-notice">(?:<small>.+?<\/small>|.)+?<\/small>/.source;
        var XFD_RELIST_RE_TXT = /<div class="xfd_relist"[\s\S]+?<\/div>(\s*|<!--.+?-->)*/.source;
        var STRUCK_RE_TXT = /<s>.+?<\/s>/.source;
        var SKIP_REGION_RE = new RegExp("(" + DELSORT_SPAN_RE_TXT + ")|(" +
            XFD_RELIST_RE_TXT + ")|(" +
            STRUCK_RE_TXT + ")", "ig");
        var skipRegionMatch;
        do {
            skipRegionMatch = SKIP_REGION_RE.exec( sectionWikitext );
            if( skipRegionMatch ) {
                spanStartIndices.push( skipRegionMatch.index );
                spanLengths.push( skipRegionMatch[0].length );
            }
        } while( skipRegionMatch );
        //console.log(spanStartIndices,spanLengths);

        /*
         * I apologize for making you have to read this regex.
         * I made a summary, though:
         *
         *  - a wikilink, without a ]] inside it
         *  - some text, without a link to userspace or user talk space
         *  - a timestamp
         *  - as an alternative to all of the above, an autosigned script
         *    and a timestamp
         *  - some comments/whitespace or some non-whitespace
         *  - finally, the end of the line
         *
         * It's also localized.
         */
        var sigRgxSrc = "(?:" + /\[\[\s*:?\s*/.source + "(" + userspcLinkRgx.both +
                /([^\]]||\](?!\]))*?/.source + ")" + /\]\]\)?/.source + "(" +
                /[^\[]|\[(?!\[)|\[\[/.source + "(?!" + userspcLinkRgx.both +
                "))*?" + DATE_FMT_RGX[mw.config.get( "wgServer" )] +
                /\s+\(UTC\)|class\s*=\s*"autosigned".+?\(UTC\)<\/small>/.source +
                ")" + /(\S*([ \t\f]|<!--.*?-->)*(?:\{\{.+?\}\})?(?!\S)|\S+([ \t\f]|<!--.*?-->)*)$/.source;
        var sigRgx = new RegExp( sigRgxSrc, "igm" );
        var matchIdx = 0;
        var match;
        var matchIdxEnd;
        var dstSpnIdx;

        sigMatchLoop:
        for( ; true ; matchIdx++ ) {
            match = sigRgx.exec( sectionWikitext );
            if( !match ) {
                console.error("[sigIdxToStrIdx] out of matches");
                return -1;
            }
            //console.log( "sig match (matchIdx = " + matchIdx + ") is >" + match[0] + "< (index = " + match.index + ")" );

            matchIdxEnd = match.index + match[0].length;

            // Validate that we're not inside a delsort span
            for( dstSpnIdx = 0; dstSpnIdx < spanStartIndices.length; dstSpnIdx++ ) {
                //console.log(spanStartIndices[dstSpnIdx],match.index,
                //    matchIdxEnd, spanStartIndices[dstSpnIdx] +
                //        spanLengths[dstSpnIdx] );
                if( match.index > spanStartIndices[dstSpnIdx] &&
                    ( matchIdxEnd <= spanStartIndices[dstSpnIdx] +
                        spanLengths[dstSpnIdx] ) ) {

                    // That wasn't really a match (as in, this match does not
                    // correspond to any sig idx in the DOM), so we can't
                    // increment matchIdx
                    matchIdx--;

                    continue sigMatchLoop;
                }
            }

            if( matchIdx === sigIdx ) {
                return match.index + match[0].length;
            }
        }
    }

    /**
     * Inserts fullReply on the next sensible line after strIdx in
     * sectionWikitext. indentLvl is the indentation level of the
     * comment we're replying to.
     *
     * This function essentially takes the indentation level and
     * position of the current comment, and looks for the first comment
     * that's indented strictly less than the current one. Then, it
     * puts the reply on the line right before that comment, and returns
     * the modified section wikitext.
     */
    function insertTextAfterIdx( sectionWikitext, strIdx, indentLvl, fullReply ) {
        //console.log( "[insertTextAfterIdx] indentLvl = " + indentLvl );

        // strIdx should point to the end of a line
        var counter = 0;
        while( ( sectionWikitext[ strIdx ] !== "\n" ) && ( counter++ <= 50 ) ) strIdx++;

        var slicedSecWikitext = sectionWikitext.slice( strIdx );
        //console.log("slicedSecWikitext = >>" + slicedSecWikitext.slice(0,50) + "<<");
        slicedSecWikitext = slicedSecWikitext.replace( /^\n/, "" );
        var candidateLines = slicedSecWikitext.split( "\n" );
        //console.log( "candidateLines =", candidateLines );

        // number of the line in sectionWikitext that'll be right after reply
        var replyLine = 0;

        var INDENT_RE = /^[:\*#]+/;
        if( slicedSecWikitext.trim().length > 0 ) {
            var currIndentation, currIndentationLvl, i;

            // Now, loop through all the comments replying to that
            // one and place our reply after the last one
            for( i = 0; i < candidateLines.length; i++ ) {
                if( candidateLines[i].trim() === "" ) {
                    continue;
                }

                // Detect indentation level of current line
                currIndentation = INDENT_RE.exec( candidateLines[i] );
                currIndentationLvl = currIndentation ? currIndentation[0].length : 0;
                //console.log(i + ">" + candidateLines[i] + "< => " + currIndentationLvl);

                if( currIndentationLvl <= indentLvl ) {

                    // If it's an XfD, we might have found a relist
                    // comment instead, so check for that
                    if( xfdType && /<div class="xfd_relist"/.test( candidateLines[i] ) ) {

                        // Our reply might go on the line above the xfd_relist line
                        var potentialReplyLine = i;

                        // Walk through the relist notice, line by line
                        // After this loop, i will point to the line on which
                        // the notice ends
                        var NEW_COMMENTS_RE = /Please add new comments below this line/;
                        while( !NEW_COMMENTS_RE.test( candidateLines[i] ) ) {
                            i++;
                        }

                        // Relists are treated as if they're indented at level 1
                        if( 1 <= indentLvl ) {
                            replyLine = potentialReplyLine;
                            break;
                        }
                    } else {
                        //console.log( "cIL <= iL, breaking" );
                        break;
                    }
                } else {
                    replyLine = i + 1;
                }
            }
            if( i === candidateLines.length ) {
                replyLine = i;
            }
        } else {

            // In this case, we may be replying to the last comment in a section
            replyLine = candidateLines.length;
        }

        // Walk backwards until non-empty line
        while( replyLine >= 1 && candidateLines[replyLine - 1].trim() === "" ) replyLine--;

        //console.log( "replyLine = " + replyLine );

        // Splice into slicedSecWikitext
        slicedSecWikitext = candidateLines
            .slice( 0, replyLine )
            .concat( [ fullReply ], candidateLines.slice( replyLine ) )
            .join( "\n" );

        // Remove extra newlines
        if( /\n\n\n+$/.test( slicedSecWikitext ) ) {
            slicedSecWikitext = slicedSecWikitext.trim() + "\n\n";
        }

        // We may need an additional newline if the two slices don't have any
        var optionalNewline = ( !sectionWikitext.slice( 0, strIdx ).endsWith( "\n" ) &&
                    !slicedSecWikitext.startsWith( "\n" ) ) ? "\n" : "";

        // Splice into sectionWikitext
        sectionWikitext = sectionWikitext.slice( 0, strIdx ) +
            optionalNewline + slicedSecWikitext;

        return sectionWikitext;
    }

    /**
     * Using the text in #reply-dialog-field, add a reply to the
     * current page. rplyToXfdNom is true if we're replying to an XfD nom,
     * in which case we should use an asterisk instead of a colon.
     * cmtAuthorDom is the username of the person who wrote the comment
     * we're replying to, parsed from the DOM. revObj is the object returned
     * by getWikitext for the page with the comment; findSectionResult is the
     * object returned by findSection for the comment.
     *
     * Returns a Deferred that resolves/rejects when the reply succeeds/fails.
     */

    function popupSurveyForm(){
        var popUpDiv = document.createElement("div");
        popUpDiv.id = "form-survey-popup";
        popUpDiv.style = "display: block; position: fixed; top: 0; right: 15px; border: 3px solid #f1f1f1; z-index: 1; background: white"
        document.body.appendChild(popUpDiv);

        // // Fetching HTML Elements in Variables by ID.

        // var openelement = document.createElement('input'); // Append Open Button
        // openelement.setAttribute("type", "button");
        // openelement.setAttribute("name", "openbutton");
        // openelement.setAttribute("value", "Open");
        // openelement.setAttribute("display", "none");
        // openelement.setAttribute("id", "popupOpenButton");
        // popUpDiv.appendChild(openelement);

        var popUpFormDiv = document.createElement("div");
        popUpFormDiv.id = "form-survey-popup-div";
        popUpFormDiv.style = "display: block; position: fixed; padding: 100px; top: 0; bottom: 0; left: 0; right: 0; border: 3px solid #f1f1f1; z-index: 999; background: rgba(90, 90, 90, 0.5);"
        popUpDiv.appendChild(popUpFormDiv);

        var popUpFormDiv1 = document.createElement("div");
        popUpFormDiv1.style = "display: block; position: fixed; padding: 15px; border: 3px solid #f1f1f1; background: white;"
        popUpFormDiv.appendChild(popUpFormDiv1);

        var createform = document.createElement('form'); // Create New Element Form
        //createform.setAttribute("action", ""); // Setting Action Attribute on Form
        createform.setAttribute("method", "post"); // Setting Method Attribute on Form
        //createform.setAttribute("id", "survey-form"); // Setting Method Attribute on Form
        popUpFormDiv1.appendChild(createform);

        var heading = document.createElement('h4'); // Heading of Form
        heading.innerHTML = "Your reply was saved!! Let's have your opinion";
        createform.appendChild(heading);

        var line = document.createElement('hr'); // Giving Horizontal Row After Heading
        createform.appendChild(line);

        if(Chng_Comment){
            var chngCommentLabel = document.createElement('label'); // Create Label for Name Field
            chngCommentLabel.innerHTML = "Why did you change your original comment?"; // Set Field Labels
            createform.appendChild(chngCommentLabel);

            var linebreak = document.createElement('br');
            createform.appendChild(linebreak);

            if(Testoption == 1 || Testoption == 4||Testoption == 5||Testoption == 7){
                var radiochngComment1 = document.createElement('input'); // Create Input Field for E-mail
                radiochngComment1.setAttribute("type", "radio");
                radiochngComment1.setAttribute("name", "chngComment");
                radiochngComment1.setAttribute("id", "CC0");
                radiochngComment1.setAttribute("value", "Tox_Score");
                createform.appendChild(radiochngComment1);

                var radiochngComment1Label = document.createElement('label'); // Create Label for Name Field
                radiochngComment1Label.innerHTML = "By seeing the Toxicity Score";                 // Set Field Labels
                createform.appendChild(radiochngComment1Label);

                var linebreak = document.createElement('br');
                createform.appendChild(linebreak);
            }
            if(Testoption == 2 || Testoption == 4||Testoption == 6||Testoption == 7){
                var radiochngComment2 = document.createElement('input'); // Create Input Field for E-mail
                radiochngComment2.setAttribute("type", "radio");
                radiochngComment2.setAttribute("name", "chngComment");
                radiochngComment2.setAttribute("id", "CC1");
                radiochngComment2.setAttribute("value", "Feed_back");
                createform.appendChild(radiochngComment2);

                var radiochngComment2Label = document.createElement('label'); // Create Label for Name Field
                radiochngComment2Label.innerHTML = "By seeing the Feedback";                 // Set Field Labels
                createform.appendChild(radiochngComment2Label);

                var linebreak = document.createElement('br');
                createform.appendChild(linebreak);
            }

            if(Testoption == 3 || Testoption == 5||Testoption == 6||Testoption == 7){
                var radiochngComment3 = document.createElement('input'); // Create Input Field for E-mail
                radiochngComment3.setAttribute("type", "radio");
                radiochngComment3.setAttribute("name", "chngComment");
                radiochngComment3.setAttribute("id", "CC2");
                radiochngComment3.setAttribute("value", "Sugg");
                createform.appendChild(radiochngComment3);

                var radiochngComment3Label = document.createElement('label'); // Create Label for Name Field
                radiochngComment3Label.innerHTML = "By seeing the Suggestion";                 // Set Field Labels
                createform.appendChild(radiochngComment3Label);

                var linebreak = document.createElement('br');
                createform.appendChild(linebreak);
            }

            if(Testoption == 4 || Testoption == 5||Testoption == 6||Testoption == 7){
                var radiochngComment4 = document.createElement('input'); // Create Input Field for E-mail
                radiochngComment4.setAttribute("type", "radio");
                radiochngComment4.setAttribute("name", "chngComment");
                radiochngComment4.setAttribute("id", "CC3");
                radiochngComment4.setAttribute("value", "all");
                createform.appendChild(radiochngComment4);

                var radiochngComment4Label = document.createElement('label'); // Create Label for Name Field
                radiochngComment4Label.innerHTML = "All of the above";                 // Set Field Labels
                createform.appendChild(radiochngComment4Label);

                var linebreak = document.createElement('br');
                createform.appendChild(linebreak);
            }
            var radiochngComment5 = document.createElement('input'); // Create Input Field for E-mail
            radiochngComment5.setAttribute("type", "radio");
            radiochngComment5.setAttribute("name", "chngComment");
            radiochngComment5.setAttribute("id", "CC4");
            radiochngComment5.setAttribute("value", "none");
            radiochngComment5.setAttribute("checked", "checked");
            createform.appendChild(radiochngComment5);

            var radiochngComment5Label = document.createElement('label'); // Create Label for Name Field
            radiochngComment5Label.innerHTML = "None of the above";                 // Set Field Labels
            createform.appendChild(radiochngComment5Label);

            var linebreak = document.createElement('br');
            createform.appendChild(linebreak);
            var linebreak = document.createElement('br');
            createform.appendChild(linebreak);
        }

        if(Use_Sugg){
            var useSuggLabel = document.createElement('label'); // Create Label for Name Field
            useSuggLabel.innerHTML = "Why did you use the suggestion?"; // Set Field Labels
            createform.appendChild(useSuggLabel);

            var linebreak = document.createElement('br');
            createform.appendChild(linebreak);

            var radioUseSugg1 = document.createElement('input'); // Create Input Field for E-mail
            radioUseSugg1.setAttribute("type", "radio");
            radioUseSugg1.setAttribute("name", "useSugg");
            radioUseSugg1.setAttribute("id", "USS0");
            radioUseSugg1.setAttribute("value", "Good");
            radioUseSugg1.setAttribute("checked", "checked");
            createform.appendChild(radioUseSugg1);

            var radioUseSugg1Label = document.createElement('label'); // Create Label for Name Field
            radioUseSugg1Label.innerHTML = "The suggestion was good";                 // Set Field Labels
            createform.appendChild(radioUseSugg1Label);

            var linebreak = document.createElement('br');
            createform.appendChild(linebreak);

            var radioUseSugg2 = document.createElement('input'); // Create Input Field for E-mail
            radioUseSugg2.setAttribute("type", "radio");
            radioUseSugg2.setAttribute("name", "useSugg");
            radioUseSugg2.setAttribute("id", "USS1");
            radioUseSugg2.setAttribute("value", "none");
            createform.appendChild(radioUseSugg2);

            var radioUseSugg2Label = document.createElement('label'); // Create Label for Name Field
            radioUseSugg2Label.innerHTML = "Other";                 // Set Field Labels
            createform.appendChild(radioUseSugg2Label);

            var linebreak = document.createElement('br');
            createform.appendChild(linebreak);
            var linebreak = document.createElement('br');
            createform.appendChild(linebreak);
        }

        if(Testoption == 1 || Testoption == 4||Testoption == 5||Testoption == 7){

            var scoreLabel = document.createElement('label'); // Create Label for Name Field
            scoreLabel.innerHTML = "Do you think showing the toxicity score was helpful to you?"; // Set Field Labels
            createform.appendChild(scoreLabel);

            var linebreak = document.createElement('br');
            createform.appendChild(linebreak);

            var radioScore1 = document.createElement('input'); // Create Input Field for E-mail
            radioScore1.setAttribute("type", "radio");
            radioScore1.setAttribute("name", "scoreH");
            radioScore1.setAttribute("id", "S1");
            radioScore1.setAttribute("value", "Yes");
            radioScore1.setAttribute("checked", "checked");
            createform.appendChild(radioScore1);

            var radioScore1Label = document.createElement('label'); // Create Label for Name Field
            radioScore1Label.innerHTML = "Yes";                 // Set Field Labels
            createform.appendChild(radioScore1Label);

            var radioScore2 = document.createElement('input'); // Create Input Field for E-mail
            radioScore2.setAttribute("type", "radio");
            radioScore2.setAttribute("name", "scoreH");
            radioScore2.setAttribute("id", "S0");
            radioScore2.setAttribute("value", "No");
            createform.appendChild(radioScore2);

            var radioScore2Label = document.createElement('label'); // Create Label for Name Field
            radioScore2Label.innerHTML = "No";                 // Set Field Labels
            createform.appendChild(radioScore2Label);

            var linebreak = document.createElement('br');
            createform.appendChild(linebreak);
            var linebreak = document.createElement('br');
            createform.appendChild(linebreak);

        }

        if(Testoption == 2 || Testoption == 4||Testoption == 6||Testoption == 7){

            var feedbackLabel = document.createElement('label'); // Create Label for Name Field
            feedbackLabel.innerHTML = "Do you think showing the feedback was helpful to you?"; // Set Field Labels
            createform.appendChild(feedbackLabel);

            var linebreak = document.createElement('br');
            createform.appendChild(linebreak);

            var radioFeedback1 = document.createElement('input'); // Create Input Field for E-mail
            radioFeedback1.setAttribute("type", "radio");
            radioFeedback1.setAttribute("name", "feedbackH");
            radioFeedback1.setAttribute("id", "F1");
            radioFeedback1.setAttribute("value", "Yes");
            radioFeedback1.setAttribute("checked", "checked");
            createform.appendChild(radioFeedback1);

            var feedbackScore1Label = document.createElement('label'); // Create Label for Name Field
            feedbackScore1Label.innerHTML = "Yes";                 // Set Field Labels
            createform.appendChild(feedbackScore1Label);

            var radioFeedback2 = document.createElement('input'); // Create Input Field for E-mail
            radioFeedback2.setAttribute("type", "radio");
            radioFeedback2.setAttribute("name", "feedbackH");
            radioFeedback2.setAttribute("id", "F0");
            radioFeedback2.setAttribute("value", "No");
            createform.appendChild(radioFeedback2);

            var feedbackScore2Label = document.createElement('label'); // Create Label for Name Field
            feedbackScore2Label.innerHTML = "No";                 // Set Field Labels
            createform.appendChild(feedbackScore2Label);

            var linebreak = document.createElement('br');
            createform.appendChild(linebreak);
            var linebreak = document.createElement('br');
            createform.appendChild(linebreak);
        }

        if(Testoption == 3 || Testoption == 5||Testoption == 6||Testoption == 7){
            var suggestionLabel = document.createElement('label'); // Create Label for Name Field
            suggestionLabel.innerHTML = "Do you think showing the suggestion was helpful to you?"; // Set Field Labels
            createform.appendChild(suggestionLabel);

            var linebreak = document.createElement('br');
            createform.appendChild(linebreak);

            var radioSuggestion1 = document.createElement('input'); // Create Input Field for E-mail
            radioSuggestion1.setAttribute("type", "radio");
            radioSuggestion1.setAttribute("name", "suggH");
            radioSuggestion1.setAttribute("id", "Su1");
            radioSuggestion1.setAttribute("value", "Yes");
            radioSuggestion1.setAttribute("checked", "checked");
            createform.appendChild(radioSuggestion1);

            var suggestionScore1Label = document.createElement('label'); // Create Label for Name Field
            suggestionScore1Label.innerHTML = "Yes";                 // Set Field Labels
            createform.appendChild(suggestionScore1Label);

            var radioSuggestion2 = document.createElement('input'); // Create Input Field for E-mail
            radioSuggestion2.setAttribute("type", "radio");
            radioSuggestion2.setAttribute("name", "suggH");
            radioSuggestion2.setAttribute("id", "Su0");
            radioSuggestion2.setAttribute("value", "No");
            createform.appendChild(radioSuggestion2);

            var suggestionScore2Label = document.createElement('label'); // Create Label for Name Field
            suggestionScore2Label.innerHTML = "No";                 // Set Field Labels
            createform.appendChild(suggestionScore2Label);

            var linebreak = document.createElement('br');
            createform.appendChild(linebreak);
            var linebreak = document.createElement('br');
            createform.appendChild(linebreak);
        }

        var submitButton = document.createElement('input'); // Append Submit Button
        submitButton.style = "margin: 10px;";
        submitButton.setAttribute("type", "submit");
        submitButton.setAttribute("value", "Submit");
        submitButton.setAttribute("id","dataSubmit");
        createform.appendChild(submitButton);

        // var closeButton = document.createElement('input'); // Append Submit Button
        // closeButton.style = "margin: 10px;";
        // closeButton.setAttribute("type", "button");
        // closeButton.setAttribute("name", "closebutton");
        // closeButton.setAttribute("value", "Close");
        // closeButton.setAttribute("id", "popupCloseButton1");
        // createform.appendChild(closeButton);

        $("#dataSubmit").click(function(){

            // const APIURL = 'http://127.0.0.1:8000/userapi/testdata/';   

            var data = {};
            data.user_name = currentUserName;
            data.page_name = currentPageName;
            data.ori_comment = Ori_String_main;
            data.replied_comment = replied_String;
            data.data_test_option = Testoption;
            data.change_comment = Chng_Comment;
            data.use_suggestion = Use_Sugg;

            if(Chng_Comment){
                data.change_comment_why = $("input[name='chngComment']:checked").val();
            }
            else{
                data.change_comment_why = "";
            }
            if(Use_Sugg){
                data.use_suggestion_why = $("input[name='useSugg']:checked").val();
            }
            else{
                data.use_suggestion_why = "";
            }

            if(Testoption == 1 || Testoption == 4||Testoption == 5||Testoption == 7){
                data.score_helpful = ($("input[name='scoreH']:checked").val()=="Yes")? 1:0;
                //console.log(radioValue);
            }
            if(Testoption == 2 || Testoption == 4||Testoption == 6||Testoption == 7){
                data.feedback_helpful = ($("input[name='feedbackH']:checked").val()=="Yes")? 1:0;
                //console.log(radioValue);
            }
            if(Testoption == 3 || Testoption == 5||Testoption == 6||Testoption == 7){
                data.suggestion_helpful = ($("input[name='suggH']:checked").val()=="Yes")?1:0;
                //console.log(radioValue);
            }

            console.log(data);

            // var json = JSON.stringify(data);
        });
    }
    
    function doReply( indentation, header, sigIdx, cmtAuthorDom, rplyToXfdNom, revObj, findSectionResult ) {
        console.log("TOP OF doReply",header,findSectionResult);
        header = [ "" + findSectionResult.sectionLevel, findSectionResult.sectionName, findSectionResult.sectionIdx ];
        var deferred = $.Deferred();

        var wikitext = revObj.content;

        try {

            // Generate reply in wikitext form
            var reply = document.getElementById( "reply-dialog-field" ).value.trim();
            replied_String = reply;

            if(Ori_String_main!="" && reply!=Ori_String_main){
                Chng_Comment = 1;
            }

            // Add a signature if one isn't already there
            if( !hasSig( reply ) ) {
                reply += " " + ( window.replyLinkSigPrefix ?
                    window.replyLinkSigPrefix : "" ) + LITERAL_SIGNATURE;
            }

            var replyLines = reply.split( "\n" );

            // If we're outdenting, reset indentation and add the
            // outdent template. This requires that there be at least
            // one character of indentation.
            var outdentCheckbox = document.getElementById( "reply-link-option-outdent" );
            if( outdentCheckbox && outdentCheckbox.checked ) {
                replyLines[0] = "{" + "{od|" + indentation.slice( 0, -1 ) +
                    "}}" + replyLines[0];
                indentation = "";
            }

            // Compose reply by adding indentation at the beginning of
            // each line (if not replying to an XfD nom) or {{pb}}'s
            // between lines (if replying to an XfD nom)
            var fullReply;
            if( rplyToXfdNom ) {

                // If there's a list in this reply, it's a bad idea to
                // use pb's, even though the markup'll probably be broken
                if( replyLines.some( function ( l ) { return l.substr( 0, 1 ) === "*"; } ) ) {
                    fullReply = replyLines.map( function ( line ) {
                        return indentation + "*" + line;
                    } ).join( "\n" );
                } else {
                    fullReply = indentation + "* " + replyLines.join( "{{pb}}" );
                }
            } else {
                fullReply = replyLines.map( function ( line ) {
                    return indentation + ":" + line;
                } ).join( "\n" );
            }

            // Prepare section metadata for getSectionWikitext call
            //console.log( "in doReply, header =", header );
            var sectionHeader, sectionIdx;
            if( header === null ) {
                sectionHeader = null, sectionIdx = -1;
            } else {
                sectionHeader = header[1], sectionIdx = header[2];
            }

            // Compatibility with User:Bility/copySectionLink
            if( document.querySelector( "span.mw-headline a#sectiontitlecopy0" ) ) {

                // If copySectionLink is active, the paragraph symbol at
                // the end is a fake
                sectionHeader = sectionHeader.replace( /\s*¶$/, "" );
            }

            // Compatibility with the "auto-number headings" preference
            if( document.querySelector( "span.mw-headline-number" ) ) {
                sectionHeader = sectionHeader.replace( /^\d+ /, "" );
            }

            var sectionWikitext = getSectionWikitext( wikitext, sectionIdx, sectionHeader );
            var oldSectionWikitext = sectionWikitext; // We'll String.replace old w/ new

            // Now, obtain the index of the end of the comment
            var strIdx = sigIdxToStrIdx( sectionWikitext, sigIdx );

            // Check for a non-negative strIdx
            if( strIdx < 0 ) {
                throw( "Negative strIdx (signature not found in wikitext)" );
            }

            // Determine the user who wrote the comment, for
            // edit-summary and sanity-check purposes
            var userRgx = new RegExp( /\[\[\s*:?\s*/.source + userspcLinkRgx.both + /\s*(.+?)(?:\/.+?)?(?:#.+?)?\s*(?:\|.+?)?\]\]/.source, "g" );
            var userMatches = sectionWikitext.slice( 0, strIdx ).match( userRgx );
            var cmtAuthorWktxt = userRgx.exec(
                    userMatches[userMatches.length - 1] )[1];

            if( cmtAuthorWktxt === "DoNotArchiveUntil" ) {
                userRgx.lastIndex = 0;
                cmtAuthorWktxt = userRgx.exec( userMatches[userMatches.length - 2] )[1];
            }

            // Normalize case, because that's what happens during
            // wikitext-to-HTML processing; also underscores to spaces
            function sanitizeUsername( u ) {
                u = u.charAt( 0 ).toUpperCase() + u.substr( 1 );
                return u.replace( /_/g, " " );
            }
            cmtAuthorWktxt = sanitizeUsername( cmtAuthorWktxt );
            cmtAuthorDom = sanitizeUsername( cmtAuthorDom );

            // Do a sanity check: is the sig username the same as the
            // DOM one?  We attempt to check sigRedirectMapping in case
            // the naive check fails
            if( cmtAuthorWktxt !== cmtAuthorDom &&
                    htmlDecode( cmtAuthorWktxt ) !== cmtAuthorDom &&
                    sigRedirectMapping[ cmtAuthorWktxt ] !== cmtAuthorDom ) {
                throw new Error( "Sanity check on sig username failed! Found " +
                    cmtAuthorWktxt + " but expected " + cmtAuthorDom +
                    " (wikitext vs DOM)" );
            }

            // Actually insert our reply into the section wikitext
            sectionWikitext = insertTextAfterIdx( sectionWikitext, strIdx,
                    indentation.length, fullReply );

            // Also, if the user wanted the edit request to be answered,
            // do that
            var editReqCheckbox = document.getElementById(  "reply-link-option-edit-req" );
            var markedEditReq = false;
            if( editReqCheckbox && editReqCheckbox.checked ) {
                sectionWikitext = markEditReqAnswered( sectionWikitext );
                markedEditReq = true;
            }

            // If the user preferences indicate a dry run, print what the
            // wikitext would have been post-edit and bail out
            var dryRunCheckbox = document.getElementById( "reply-link-option-dry-run" );
            if( window.replyLinkDryRun === "always" || ( dryRunCheckbox && dryRunCheckbox.checked ) ) {
                console.log( "~~~~~~ DRY RUN CONCLUDED ~~~~~~" );
                console.log( sectionWikitext );
                setStatus( "Check the console for the dry-run results." );
                document.querySelector( "#reply-link-buttons button" ).disabled = false;
                deferred.resolve();
                return deferred;
            }

            var newWikitext = wikitext.replace( oldSectionWikitext,
                    sectionWikitext );

            // Build summary
            var defaultSummmary = "Replying to " +
                ( rplyToXfdNom ? xfdType + " nomination by " : "" ) +
                cmtAuthorWktxt +
                ( markedEditReq ? " and marking edit request as answered" : "" );
            var customSummaryField = document.getElementById( "reply-link-summary" );
            var summaryCore = defaultSummmary;
            if( window.replyLinkCustomSummary && customSummaryField.value ) {
                summaryCore = customSummaryField.value.trim();
            }
            var summary = "/* " + sectionHeader + " */ " + summaryCore + ADVERT;

            // Send another request, this time to actually edit the
            // page
            api.postWithToken( "csrf", {
                action: "edit",
                title: findSectionResult.page,
                summary: summary,
                text: newWikitext,
                basetimestamp: revObj.timestamp
            } ).done ( function ( data ) {

                // We put this function on the window object because we
                // give the user a "reload" link, and it'll trigger the function
                window.replyLinkReload = function () {
                    window.location.hash = sectionHeader.replace( / /g, "_" );
                    window.location.reload( true );
                };
                if ( data && data.edit && data.edit.result && data.edit.result == "Success" ) {
                    var needPurge = findSectionResult.page !== currentPageName;

                    function finishReply( _ ) {
                        var reloadHtml = window.replyLinkAutoReload ? "automatically reloading"
                            : "<a href='javascript:window.replyLinkReload()' class='reply-link-reload'>Reload</a>";
                        setStatus( "Reply saved! (" + reloadHtml + ")" );

                        // Required to permit reload to happen, checked in onbeforeunload
                        replyWasSaved = true;

                        if( window.replyLinkAutoReload ) {
                            window.replyLinkReload();
                        }

                        deferred.resolve();

                        // if(Click_preview == 1 && Testoption!=0){
                        //     popupSurveyForm();
                        // }  

                    }

                    if( needPurge ) {
                        setStatus( "Reply saved! Purging..." );
                        api.post( { action: "purge", titles: currentPageName } ).done( finishReply );
                    } else {
                        finishReply();
                    }
                } else {
                    if( data && data.edit && data.edit.spamblacklist ) {
                        setStatus( "Error! Your post contained a link on the <a href=" +
                            "\"https://en.wikipedia.org/wiki/Wikipedia:Spam_blacklist\"" +
                            ">spam blacklist</a>. Remove the link(s) to: " +
                            data.edit.spamblacklist.split( "|" ).join( ", " ) + " to allow saving." );
                        document.querySelector( "#reply-link-buttons button" ).disabled = false;
                    } else {
                        setStatus( "While saving, the edit query returned an error." +
                            " Check the browser console for more information." );
                    }

                    deferred.reject();
                }
                //console.log(data);
                document.getElementById( "reply-dialog-field" ).style["background-image"] = "";
            } ).fail ( function( code, result ) {
                setStatus( "While replying, the edit failed." );
                console.log(code);
                console.log(result);
                deferred.reject();
            } );
        } catch ( e ) {
            setStatusError( e );
            deferred.reject();
        }

        return deferred;
    }


    function handleWrapperClick ( linkLabel, parent, rplyToXfdNom ) {
        return function ( evt ) {
            $.when( mw.messages.exists( INT_MSG_KEYS[0] ) ? 1 :
                    api.loadMessages( INT_MSG_KEYS ) ).then( function () {
                var newLink = this;
                var newLinkWrapper = this.parentNode;

                if( !userspcLinkRgx ) {
                    buildUserspcLinkRgx();
                }

                // Remove previous panel
                var prevPanel = document.getElementById( "reply-link-panel" );
                if( prevPanel ) {
                    prevPanel.remove();
                }

                // Reset previous cancel links
                var cancelLinks = iterableToList( document.querySelectorAll(
                            ".reply-link-wrapper a" ) );
                cancelLinks.forEach( function ( el ) {
                    if( el != newLink ) el.textContent = el.dataset.originalLabel;
                } );

                // Handle disable action
                if( newLink.textContent === linkLabel ) {

                    // Disable this link
                    newLink.textContent = "cancel " + linkLabel;
                } else {

                    // We've already cancelled the reply
                    if($('#reply-link-panel_1').length!=0){
                        console.log("not removed yet");
                        Try_number = 1;
                        $('#reply-link-panel_1').remove();
                    }
                    newLink.textContent = linkLabel;
                    evt.preventDefault();
                    return false;
                }

                // Figure out the username of the author
                // of the comment we're replying to
                var cmtAuthorAndLink = getCommentAuthor( newLinkWrapper );

                if(cmtAuthorAndLink!=null){
                    try {
                        var cmtAuthor = cmtAuthorAndLink.username,
                            cmtLink = cmtAuthorAndLink.link;
                    } catch ( e ) {
                        setStatusError( e );
                    }
                }else{
                    var cmtAuthor = "dummy",            // new
                        cmtLink = null;                 // new
                }

                // Create panel
                var panelEl = document.createElement( "div" );
                panelEl.id = "reply-link-panel";
                panelEl.innerHTML = "<textarea id='reply-dialog-field' class='mw-ui-input'" +
                    " placeholder='Reply here!'></textarea>" +
                    ( window.replyLinkCustomSummary ? "<label for='reply-link-summary'>Summary: </label>" +
                        "<input id='reply-link-summary' class='mw-ui-input' placeholder='Edit summary' " +
                        "value='Replying to " + cmtAuthor + "'/><br />" : "" ) +
                    "<table style='border-collapse:collapse'><tr><td id='reply-link-buttons' style='width: " +
                    ( window.replyLinkPreloadPing === "button" ? "325" : "255" ) + "px'>" +
                    "<button id='reply-dialog-button' class='mw-ui-button mw-ui-progressive'>Reply</button> " +
                    "<button id='reply-link-preview-button' class='mw-ui-button'>Preview</button>" +
                    ( window.replyLinkPreloadPing === "button" ?
                        " <button id='reply-link-ping-button' class='mw-ui-button'>Ping</button>" : "" ) +
                    "<button id='reply-link-cancel-button' class='mw-ui-button mw-ui-quiet mw-ui-destructive'>Cancel</button></td>" +
                    "<td id='reply-dialog-status'></span><div style='clear:left'></td></tr></table>" +
                    "<div id='reply-link-options' class='gone-on-empty' style='margin-top: 0.5em'></div>" +
                    "<div id='reply-link-preview' class='gone-on-empty' style='border: thin dashed gray; padding: 0.5em; margin-top: 0.5em'></div>";
                parent.insertBefore( panelEl, newLinkWrapper.nextSibling );
                var replyDialogField = document.getElementById( "reply-dialog-field" );
                replyDialogField.style = "padding: 0.625em; min-height: 10em; margin-bottom: 0.75em;";
                if( window.replyLinkPreloadPing === "always" &&
                        cmtAuthor &&
                        cmtAuthor !== mw.config.get( "wgUserName" ) &&
                        !/(\d+.){3}\d+/.test( cmtAuthor ) ) {
                    replyDialogField.value = window.replyLinkPreloadPingTpl.replace( "##", cmtAuthor );
                }

                // Fill up #reply-link-options
                function newOption( id, text, defaultOn ) {
                    var newCheckbox = document.createElement( "input" );
                    newCheckbox.type = "checkbox";
                    newCheckbox.id = id;
                    if( defaultOn ) {
                        newCheckbox.checked = true;
                    }
                    var newLabel = document.createElement( "label" );
                    newLabel.htmlFor = id;
                    newLabel.appendChild( document.createTextNode( text ) );
                    document.getElementById( "reply-link-options" ).appendChild( newCheckbox );
                    document.getElementById( "reply-link-options" ).appendChild( newLabel );
                }

                // Fetch metadata about this specific comment
                var ourMetadata = metadata[this.id];

                // If the dry-run option is "checkbox", add an option to make it
                // a dry run
                if( window.replyLinkDryRun === "checkbox" ) {
                    newOption( "reply-link-option-dry-run", "Don't actually edit?", true );
                }

                // If the current section header text indicates an edit request,
                // offer to mark it as answered
                if( EDIT_REQ_REGEX.test( ourMetadata[1][1] ) ) {
                    newOption( "reply-link-option-edit-req", "Mark edit request as answered?", false );
                }

                // If the previous comment was indented by OUTDENT_THRESH,
                // offer to outdent
                if( ourMetadata[0].length >= OUTDENT_THRESH ) {
                    newOption( "reply-link-option-outdent", "Outdent?", false );
                }

                /* Commented out because I could never get it to work
                // Autofill with a recommendation if we're replying to a nom
                if( rplyToXfdNom ) {
                    replyDialogField.value = "'''Comment'''";

                    // Highlight the "Comment" part so the user can change it
                    var range = document.createRange();
                    range.selectNodeContents( replyDialogField );
                    //range.setStart( replyDialogField, 3 ); // start of "Comment"
                    //range.setEnd( replyDialogField, 10 ); // end of "Comment"
                    var sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange( range );
                }*/

                // Close handler
                window.onbeforeunload = function ( e ) {
                    if( !replyWasSaved &&
                            document.getElementById( "reply-dialog-field" ) &&
                            document.getElementById( "reply-dialog-field" ).value ) {
                        var txt = "You've started a reply but haven't posted it";
                        e.returnValue = txt;
                        return txt;
                    }
                };


                // Called by the "Reply" button, Ctrl-Enter in the text area, and
                // Enter/Ctrl-Enter in the summary field
                function startReply() {

                    if(Click_preview == 1 && Testoption!=0){
                        popupSurveyForm();
                    } 

                    // Change UI to make it clear we're performing an operation
                    document.getElementById( "reply-dialog-field" ).style["background-image"] =
                        "url(" + window.replyLinkPendingImageUrl + ")";
                    document.querySelector( "#reply-link-buttons button" ).disabled = true;
                    setStatus( "Loading..." );

                    var parsoidUrl = PARSOID_ENDPOINT + encodeURIComponent( currentPageName ),
                        findSectionResultPromise = $.get( parsoidUrl )
                            .then( function ( parsoidDomString ) {
                                return findSection( parsoidDomString, cmtLink );
                        },console.error );

                    var revObjPromise = findSectionResultPromise.then( function ( findSectionResult ) {
                        return getWikitext( findSectionResult.page );
                    },console.error );

                    $.when( findSectionResultPromise, revObjPromise ).then( function ( findSectionResult, revObj ) {
                        // ourMetadata contains data in the format:
                        // [indentation, header, sigIdx]
                        doReply( ourMetadata[0], ourMetadata[1], ourMetadata[2],
                            cmtAuthor, rplyToXfdNom, revObj, findSectionResult );
                    }, function (e) { setStatusError(new Error(e))} );
                }


                // Event listener for the "Reply" button
                document.getElementById( "reply-dialog-button" )
                    .addEventListener( "click", startReply );

                // // Event listener for the text area
                // document.getElementById( "reply-dialog-field" )
                //     .addEventListener( "keydown", function ( e ) {
                //         if( e.ctrlKey && ( e.keyCode == 10 || e.keyCode == 13 ) ) {
                //             testTextOutput = "";                // new add
                //             startReply();
                //         }
                //         else{
                //             testTextOutput = document.getElementById( "reply-dialog-field" ).value.trim();     // new add
                //             //testTextOutput += e.key;            // new add
                //             console.log(wikitextToTextContent(testTextOutput));         // new add
                //         }
                //     } );

                // add new: try modal, Event listener for the "Preview" button, commenting since it is not working

                // var cur_div =  document.getElementById('reply-link-panel');
                // var panelEl1 = document.createElement( "div" );
                // panelEl1.setAttribute("style", "display:none;position:relative;z-index:1;width:100%"+
                //                         "height:100%;overflow:auto;background-color: rgb(0,0,0);background-color: rgba(0,0,0,0.4);");

                // panelEl1.id = "reply-link-panel_1";
                // //panelEl1.style.zIndex = 1;
                // //panelEl1.style.position = cur_div.style.position;

                // var panelEl2 = document.createElement( "div" );
                // panelEl2.setAttribute("style", "background-color: #fefefe; margin:15% auto;padding: 20px; border: 1px solid #888; width: 80%;");
               
                // panelEl2.innerHTML = "<textarea readonly id='reply-dialog-field_1' class='mw-ui-input'" +
                //     " placeholder='Reply here!'></textarea>" +
                //     "<table style='border-collapse:collapse'><tr><td id='reply-link-buttons_1'>" +
                //     "<button id='use-suggestion' class='mw-ui-button mw-ui-progressive'>Use Suggested one</button> " +
                //     "<button id='use-original' class='mw-ui-button'>Post original one</button>" +
                //     "<button id='reply-link-cancel-button_1' class='mw-ui-button mw-ui-quiet mw-ui-destructive'>Cancel</button></td>" 
                // panelEl1.innerHTML = panelEl2;
                
                // //parent.insertBefore(panelEl1, cur_div.nextSibling);
                // modalDiv = document.getElementById("reply-link-panel_1");
                 
                // document.getElementById( "reply-link-preview-button" )
                //     .addEventListener( "click", function () {
                //         console.log("from inside click function");
                //         modalDiv.style.display = "block";
                // });

                // // When the user clicks anywhere outside of the modal, close it
                // window.onclick = function(event) {
                //     if (event.target == modalDiv) {
                //         modalDiv.style.display = "none";
                //     }
                // }


                // add new: try modal, Event listener for the "Preview" button

                //   Event listener for the "Preview" button
                document.getElementById( "reply-link-preview-button" )
                    .addEventListener( "click", function () {

                        Click_preview = 1;

                        if(Testoption != 0){

                            // add new: create panel 
                            var textString = document.getElementById( "reply-dialog-field" ).value.trim();
                            console.log("textString with trim: "+textString);

                            var textString = document.getElementById( "reply-dialog-field" ).value;
                            console.log("textString: "+textString);

                            var cur_div =  document.getElementById('reply-link-panel');

                            if((Try_number == 1) || (textString!=Ori_String)){
                                // add new: call perspectiveAPI

                                if(Try_number == 1){
                                    Ori_String_main = textString;
                                }

                                Try_number +=1;
                                Ori_String = textString ;
                                var panelEl1 = document.createElement( "div" );

                                panelEl1.id = "reply-link-panel_1";
                                //panelEl1.style.zIndex = 1;
                                panelEl1.style.position = cur_div.style.position;
            
                                panelEl1.innerHTML = "<div id = 'newDiv' style = 'border-style: groove;'>" +
                                    "<p id = 'ori-com-box-p' style = 'text-decoration: underline'> Your Comment</p>" +
                                    "<p id = 'ori-com-p' style = 'font-style: italic'></p>" +
                                    "<span id = 'toxicity-span'>Toxicity Score: </span>" +
                                    "<span id = 'toxicity-span-1' style = 'font-weight: bold'> </span>" +
                                    "<p id = 'toxicity-score-p'> </p>" +
                                    "<p id = 'feedback-p'></p>"+
                                    "<p id ='sugg-com-box-p' style = 'text-decoration: underline'>Suggested Comment: </p>" +
                                    "<p id = 'sugg-com-p1' style = 'font-style: italic'> 1. Suggested Comment</p>" +
                                    "<p id = 'sugg-com-p2' style = 'font-style: italic'> 2. Suggested Comment</p>" +
                                    "<p id = 'sugg-com-p3' style = 'font-style: italic'> 3. Suggested Comment</p>" +
                                    "</div> "+
                                    "<table style = 'border-collapse:collapse'><tr><td id='reply-link-buttons_1'>" +
                                    "<button id = 'use-suggestion' class='mw-ui-button mw-ui-progressive'>Use Suggested one</button> " +
                                    "<button id = 'use-original' class='mw-ui-button'>Post original one</button>" +
                                    "<button id = 'reply-link-cancel-button_1' class='mw-ui-button mw-ui-quiet mw-ui-destructive'>Cancel</button></td>" 
                            
                                parent.insertBefore( panelEl1, newLinkWrapper.nextSibling );
                                cur_div.style.display = "none";
                                panelEl1.style.display = "block";

                                $("#ori-com-p").text("\""+textString+"\"");
            
                                mw.util.addCSS(
                                    "#reply-link-panel_1 { display:none;} "+
                                    "#use-suggestion {display : none}"+
                                    "#use-original {display : none}"+
                                    "#sugg-com-box-p {display : none}"+
                                    "#sugg-com-p1 {display: none}"
                                );
                            
                                const API_KEY = 'AIzaSyDXuNaU-cLxLU9eZGNnQsphvfqqyMELWJw';

                                const analyzeURL = 'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=' + API_KEY;
                                const x = new XMLHttpRequest();
                                const composedComment = `{comment: {text: "${textString}"},
                                    languages: ["en"],
                                    requestedAttributes: {TOXICITY:{}, PROFANITY:{}, IDENTITY_ATTACK:{}, INSULT:{},THREAT:{},SEXUALLY_EXPLICIT:{},FLIRTATION:{}} }`;
                                // Adds the required HTTP header for form data POST requests.
                                x.open('POST', analyzeURL, true);
                                x.setRequestHeader('Content-Type', 'application/json');
                                x.responseType = 'json';
                                var score = ""; 
                                x.onreadystatechange = function() {
                                    if (this.readyState == 4 && this.status == 200) {
                                        console.log(this.response);
                                        console.log(this.response.attributeScores.TOXICITY.summaryScore.value);
                                        var toxi_score = this.response.attributeScores.TOXICITY.summaryScore.value;
                                        if(toxi_score < 0.35){        // score is low, no need to show any message
                                            Tox_level = 0;
                                            console.log("score is less than 0.35"); 
                                        }
                                        else if(toxi_score >= 0.35 && toxi_score < 0.70){
                                            Tox_level = 1;
                                        }
                                        else{  
                                            Tox_level = 2;                     
                                        }  
                                        score += this.response.attributeScores.TOXICITY.summaryScore.value;

                                        if(Testoption == 1||Testoption == 4||Testoption == 5||Testoption == 7){             // showing "score+prob"
                                            $("#toxicity-span-1").text(score);
                                            if(Tox_level == 0)
                                            {
                                                $("#toxicity-score-p").text("very low toxicity score, you are good to go");
                                            }
                                            else if(Tox_level == 1){
                                                $("#toxicity-score-p").text("Medium toxicity score, you may want to check the comment again");
                                            }
                                            else{
                                                $("#toxicity-score-p").text("Very high toxicity score, please check your comment again");
                                            }
                                        }
                                        if(Testoption == 2||Testoption == 4||Testoption == 6||Testoption == 7){         // showing feedback
                                            if(Tox_level == 0){
                                                $("#feedback-p").text("Feedback: Your comment is likely to follow community rules and norms");
                                            }
                                            else if(Tox_level == 1){
                                                $("#feedback-p").text("Feedback: It is unsure whether your comment follow community rules and norms");
                                            }
                                            else{
                                                $("#feedback-p").text("Feedback: Your commeny may violate community rules and norms");
                                            }
                                        }
                                        if(Testoption == 3||Testoption == 5||Testoption == 6||Testoption == 7){    // showing suggestion
                                            $("#sugg-com-box-p").show();
                                            $("#sugg-com-p1").show();
                                            $("#sugg-com-p2").show();
                                            $("#sugg-com-p3").show();
                                            $("#use-suggestion").show();
                                            $("#use-original").show();
                                            // ////////    show suggestion collectde from crowdworker 
                                        } 
                                        else{
                                            $("#sugg-com-box-p").hide();
                                            $("#sugg-com-p1").hide();
                                            $("#sugg-com-p2").hide();
                                            $("#sugg-com-p3").hide();
                                            $("#use-suggestion").hide();
                                            $("#use-original").hide();
                                        }

                                        $("#use-original").click(function(){
                                            $("#reply-link-panel_1").remove();
                                            cur_div.style.display = "block";
                                        });

                                        $("#use-suggestion").click(function(){
                                            var suggestionText = $("#sugg-com-box-p").text();
                                            console.log(suggestionText);
                                            $("#reply-link-panel_1").remove();
                                            cur_div.style.display = "block";
                                            $("#reply-dialog-field").val(suggestionText);  
                                            Use_Sugg = 1; 
                                        });

                                        $("#reply-link-cancel-button_1").click(function(){
                                            $("#reply-link-panel_1").remove();
                                            cur_div.style.display = "block";
                                            Use_Sugg = 0;
                                        });

                                        // document.getElementById("use-original").addEventListener( "click", function () {
                                        //     document.getElementById("reply-link-panel_1").remove();
                                        //     cur_div.style.display = "block";
                                            
                                        // } );
                
                                        // document.getElementById("reply-link-cancel-button_1").addEventListener( "click", function () {
                                        //     document.getElementById("reply-link-panel_1").remove();
                                        //     cur_div.style.display = "block";
                                        // } );

                                        // document.getElementById("use-suggestion").addEventListener( "click", function () {
                                        //     var suggestionText = document.getElementById("sugg-com-p").textContent;
                                        //     console.log(suggestionText);
                                        //     document.getElementById("reply-link-panel_1").remove();
                                        //     cur_div.style.display = "block";
                                        //     document.getElementById("reply-dialog-field").value = suggestionText;                                                                              
                                        // } );
                                            
                                    }
                                };
                                x.send(composedComment);
                                // add new: call perspectiveAPI and show value in the box
                            }
                        }


                        // var panelEl1 = document.createElement( "div" );

                        // panelEl1.id = "reply-link-panel_1";
                        // //panelEl1.style.zIndex = 1;
                        // panelEl1.style.position = cur_div.style.position;

                        // panelEl1.innerHTML = "<div id = 'newDiv' style = 'border-style: groove;'>" +
                        //     "<p id = 'ori-com-box-p' style = 'text-decoration: underline'> Original Comment</p>" +
                        //     "<p id = 'ori-com-p' style = 'font-style: italic'></p>" +
                        //     "<span id = 'toxicity-span'>Toxicity Score: </span>" +
                        //     "<span id = 'toxicity-span-1' style = 'font-weight: bold'> </span>" +
                        //     "<p id = 'toxicity-score-p'> </p>" +
                        //     "<p id ='sugg-com-box-p' style = 'text-decoration: underline'>Suggested Comment: </p>" +
                        //     "<p id = 'sugg-com-p' style = 'font-style: italic'> Suggested Comment</p>" +
                        //     "</div> "+
                        //     //"<textarea readonly id='reply-dialog-field_1' class='mw-ui-input'" +
                        //     //" placeholder='Reply here!'></textarea>" +
                        //     "<table style='border-collapse:collapse'><tr><td id='reply-link-buttons_1'>" +
                        //     "<button id='use-suggestion' class='mw-ui-button mw-ui-progressive'>Use Suggested one</button> " +
                        //     "<button id='use-original' class='mw-ui-button'>Post original one</button>" +
                        //     "<button id='reply-link-cancel-button_1' class='mw-ui-button mw-ui-quiet mw-ui-destructive'>Cancel</button></td>" 
                        
                        // panelEl1.style.display = "none";
                        // parent.insertBefore( panelEl1, newLinkWrapper.nextSibling );

                        // mw.util.addCSS(
                        //     "#reply-link-panel_1 { display:none;} "
                        // );

                        // //cur_div.style.display = "none";
                        
                        // $("#ori-com-p").text("\""+textString+"\"");

                        // // add new: call perspectiveAPI and show value in the box
                        
                        // const API_KEY = 'AIzaSyDXuNaU-cLxLU9eZGNnQsphvfqqyMELWJw';

                        // const analyzeURL = 'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=' + API_KEY;
                        // const x = new XMLHttpRequest();
                        // const composedComment = `{comment: {text: "${textString}"},
                        //     languages: ["en"],
                        //     requestedAttributes: {TOXICITY:{}} }`;
                        // // Adds the required HTTP header for form data POST requests.
                        // x.open('POST', analyzeURL, true);
                        // x.setRequestHeader('Content-Type', 'application/json');
                        // //x.withCredentials = true;
                        // // The Perspective API responds with JSON, so let Chrome parse it.
                        // x.responseType = 'json';
                        // var score = ""; 
                        // x.onreadystatechange = function() {
                        //     if (this.readyState == 4 && this.status == 200) {
                        //         console.log(this.response);
                        //         console.log(this.response.attributeScores.TOXICITY.summaryScore.value);
                        //         var toxi_score = this.response.attributeScores.TOXICITY.summaryScore.value;
                        //       if(toxi_score < 0.35){
                        //             console.log("score is less than 0.35");  
                        //             document.getElementById("reply-link-panel_1").remove();
                        //             cur_div.style.display = "block";
                        //         }
                        //         else{
                        //             console.log("score is greater than 35");  
                        //             score += this.response.attributeScores.TOXICITY.summaryScore.value;
                        //             $("#toxicity-span-1").text(score);
                        //             $("#toxicity-score-p").text("Very toxic");
                        //             panelEl1.style.display = "block";
                        //             cur_div.style.display = "none";
                        //             //document.getElementById("toxicity-span-1").text = score;
                        //             //document.getElementById( "reply-dialog-field_1" ).value = "Hey, your comment has some toxicity. \nThe toxicity score is: "+ 
                        //                                                         //score + "\nYou can use this one instead: \nI am not agree with you.";
                        //         }
                        //     }
                        // };
                        // x.send(composedComment);

                        // add new: call perspectiveAPI and show value in the box

                        
                        // document.getElementById("use-suggestion").addEventListener( "click", function () {
                        //     var suggestionText = document.getElementById( "reply-dialog-field_1" ).value;
                        //     var lines = suggestionText.split("\n");
    
                        //     sText = lines[3];
                        //     document.getElementById("reply-link-panel_1").remove();
                        //     cur_div.style.display = "block";
                        //     document.getElementById("reply-dialog-field").value = sText;
                            
                        // } );

                        // document.getElementById("use-original").addEventListener( "click", function () {
                        //     document.getElementById("reply-link-panel_1").remove();
                        //     cur_div.style.display = "block";
                            
                        // } );

                        // document.getElementById("reply-link-cancel-button_1").addEventListener( "click", function () {
                        //     document.getElementById("reply-link-panel_1").remove();
                        //     cur_div.style.display = "block";
                        // } );

                        // add new: create panel 
    


                        //var sanitizedCode = encodeURIComponent( document.getElementById( "reply-dialog-field" ).value );
                        // var sanitizedCode = encodeURIComponent( "something for now" );
                        // console.log(sanitizedCode);
                        // console.log(mw.config.get( "wgPageName" ));
                        // console.log(encodeURIComponent( mw.config.get( "wgPageName" ) ));
                        // var url = "https://localhost:8080/api/rest_v1/transform/wikitext/to/html/" ;
                        // $.post( url + encodeURIComponent( mw.config.get( "wgPageName" ) ) ,
                        //     "wikitext=" + sanitizedCode + "&body_only=true",
                        //     function ( html ) {
                        //         document.getElementById( "reply-link-preview" ).innerHTML = html;
                        // $.post( "https:" + mw.config.get( "wgServer" ) +
                        //     "/api/rest_v1/transform/wikitext/to/html/" + encodeURIComponent( currentPageName ),
                        //     "wikitext=" + sanitizedCode + "&body_only=true",
                        //     function ( html ) {
                        //         document.getElementById( "reply-link-preview" ).innerHTML = html;

                        //         // The hrefs in the wikilinks are all given locally for some reason
                        //         var links = document.querySelectorAll( "#reply-link-preview a[rel='mw:WikiLink']" );
                        //         for( var i = 0, n = links.length; i < n; i++ ) {
                        //             links[i].href = mw.util.getUrl( links[i].getAttribute("href").replace( /^\.\//, "" ) );
                        //         }
                        //    } );
                    } );

                if( window.replyLinkPreloadPing === "button" ) {
                    document.getElementById( "reply-link-ping-button" )
                        .addEventListener( "click", function () {
                            replyDialogField.value = window.replyLinkPreloadPingTpl
                                .replace( "##", cmtAuthor ) + replyDialogField.value;
                        } );
                }

                // Event listener for the "Cancel" button
                document.getElementById( "reply-link-cancel-button" )
                    .addEventListener( "click", function () {
                        Try_number = 1;
                        newLink.textContent = linkLabel;
                        panelEl.remove();
                        // if ($.contains(document, $("#reply-link-panel_1"))) {
                        //     panelEl1.remove();
                        // }
                        // if($('#reply-link-panel_1').length!=0){
                        //     console.log("not removed yet");
                        //     panelEl1.remove();
                        // }
                    } );

                // Event listeners for the custom edit summary field
                if( window.replyLinkCustomSummary ) {
                    document.getElementById( "reply-link-summary" )
                        .addEventListener( "keydown", function ( e ) {
                            if( e.keyCode == 10 || e.keyCode == 13 ) {
                                startReply();
                            }
                        } );
                }

                if( window.replyLinkTestInstantReply ) {
                    startReply();
                }
            }.bind( this ) );

            // Cancel default event handler
            evt.preventDefault();
            return false;
        }
    }

    /**
     * Adds a "(reply)" link after the provided text node, giving it
     * the provided element id. anyIndentation is true if there's any
     * indentation (i.e. indentation string is not the empty string)
     */
    function attachLinkAfterNode( node, preferredId, anyIndentation ) {

        // Choose a parent node - walk up tree until we're under a dd, li,
        // p, or div. This walk is a bit unsafe, but this function should
        // only get called in a place where the walk will succeed.
        console.log("from attachLinkAfterNode function");
        var parent = node;
        do {
            parent = parent.parentNode;
        } while( !( /^(p|dd|li|div)$/.test( parent.tagName.toLowerCase() ) ) );

        // Determine whether we're replying to an XfD nom
        var rplyToXfdNom = false;
        if( xfdType === "AfD" || xfdType === "MfD" ) {

            // If the comment is non-indented, we are replying to a nom
            rplyToXfdNom = !anyIndentation;
        } else if( xfdType === "TfD" || xfdType === "FfD" ) {

            // If the sibling before the previous sibling of this node
            // is a h4, then this is a nom
            rplyToXfdNom = parent.previousElementSibling &&
                parent.previousElementSibling.previousElementSibling &&
                parent.previousElementSibling.previousElementSibling.nodeType === 1 &&
                parent.previousElementSibling.previousElementSibling.tagName.toLowerCase() === "h4";
        } else if( xfdType === "CfD" ) {

            // If our grandparent is a dl and our grandparent's previous
            // sibling is a h4, then this is a nom
            rplyToXfdNom = parent.parentNode.tagName.toLowerCase() === "dl" &&
                parent.parentNode.previousElementSibling.nodeType === 1 &&
                parent.parentNode.previousElementSibling.tagName.toLowerCase() === "h4";
        }

        // Choose link label: if we're replying to an XfD, customize it
        var linkLabel = "reply" + ( rplyToXfdNom ? " to " + xfdType : "" );

        // Construct new link
        var newLinkWrapper = document.createElement( "span" );
        newLinkWrapper.className = "reply-link-wrapper";
        var newLink = document.createElement( "a" );
        newLink.href = "#";
        newLink.id = preferredId;
        newLink.dataset.originalLabel = linkLabel;
        newLink.appendChild( document.createTextNode( linkLabel ) );
        newLink.addEventListener( "click", handleWrapperClick( linkLabel, parent, rplyToXfdNom ) );
        newLinkWrapper.appendChild( document.createTextNode( " (" ) );
        newLinkWrapper.appendChild( newLink );
        newLinkWrapper.appendChild( document.createTextNode( ")" ) );

        // Insert new link into DOM
        parent.insertBefore( newLinkWrapper, node.nextSibling );
    }

    /**
     * Uses attachLinkAfterTextNode to add a reply link after every
     * timestamp on the page.
     */
    function attachLinks () {
        console.log("hello from attachlinks fucntion");
        var mainContent = findMainContentEl();
        if( !mainContent ) {
            console.log("can not find main content, returing");
            return;
        }
        var contentEls = mainContent.children;

        // Find the index of the first header in contentEls
        var headerIndex = 0;
        for( headerIndex = 0; headerIndex < contentEls.length; headerIndex++ ) {
            if( contentEls[ headerIndex ].tagName.toLowerCase().startsWith( "h" ) ) break;
        }

        // If we didn't find any headers at all, that's a problem and we
        // should bail
        if( mainContent.querySelector( "div.hover-edit-section" ) ) {
            headerIndex = 0;
        } else if( headerIndex === contentEls.length ) {
            console.error( "Didn't find any headers - hit end of loop!" );
            return;
        }

        // We also should include the first header
        if( headerIndex > 0 ) {
            headerIndex--;
        }

        // Each element is a 2-element list of [level, node]
        var parseStack = iterableToList( contentEls ).slice( headerIndex );
        parseStack.reverse();
        parseStack = parseStack.map( function ( el ) { return [ "", el ]; } );

        // Main parse loop
        var node;
        var currIndentation; // A string of symbols, like ":*::"
        var newIndentSymbol;
        var stackEl; // current element from the parse stack
        var idNum = 0; // used to make id's for the links
        var linkId = ""; // will be the element id for this link
        while( parseStack.length ) {
            stackEl = parseStack.pop();
            node = stackEl[1];
            console.log("current node = " +node);
            currIndentation = stackEl[0];

            // Compatibility with "Comments in Local Time"
            var isLocalCommentsSpan = node.nodeType === 1 &&
                "span" === node.tagName.toLowerCase() &&
                node.className.indexOf( "localcomments" ) >= 0;

            var isSmall = node.nodeType === 1 && (
                    node.tagName.toLowerCase() === "small" ||
                    ( node.tagName.toLowerCase() === "span" &&
                    node.style && node.style.getPropertyValue( "font-size" ) === "85%" ) );

            // Small nodes are okay, unless they're delsort notices
            var isOkSmallNode = isSmall &&
                node.className.indexOf( "delsort-notice" ) < 0;

            console.log("node.nodeType = "+node.nodeType);

            if( ( node.nodeType === 3 ) ||
                    isOkSmallNode ||
                    isLocalCommentsSpan )  {

                console.log("Inside 1st if of calling attachLinkAfterNode()");

                // If the current node has a timestamp, attach a link to it
                // Also, no links after timestamps, because it's just like
                // having normal text afterwards, which is rejected (because
                // that means someone put a timestamp in the middle of a
                // paragraph)
                if( TIMESTAMP_REGEX.test( node.textContent ) &&
                        ( node.previousSibling || isSmall ) &&
                        ( !node.nextElementSibling ||
                            node.nextElementSibling.tagName.toLowerCase() !== "a" ) ) {
                    linkId = "reply-link-" + idNum;
                    console.log("Inside 2nd if of calling attachLinkAfterNode()");
                    attachLinkAfterNode( node, linkId, !!currIndentation );
                    idNum++;

                    // Update global metadata dictionary
                    metadata[linkId] = currIndentation;
                }
            } else if( node.nodeType === 1 &&
                    /^(div|p|dl|dd|ul|li|span|ol|table|tbody|tr|td)$/.test( node.tagName.toLowerCase() ) ) {
                console.log("Inside else of calling attachLinkAfterNode()");
                switch( node.tagName.toLowerCase() ) {
                case "dl": newIndentSymbol = ":"; break;
                case "ul": newIndentSymbol = "*"; break;
                case "ol": newIndentSymbol = "#"; break;
                case "table":
                    if( node.className.indexOf( "mw-collapsible" ) < 0 ) {
                        continue;
                    }
                    break;
                default: newIndentSymbol = ""; break;
                }

                var childNodes = node.childNodes;
                for( let i = 0, numNodes = childNodes.length; i < numNodes; i++ ) {
                    parseStack.push( [ currIndentation + newIndentSymbol,
                        childNodes[i] ] );
                }
            }
        }

        // This loop adds two entries in the metadata dictionary:
        // the header data, and the sigIdx values
        var sigIdxEls = iterableToList( mainContent.querySelectorAll(
                HEADER_SELECTOR + ",span.reply-link-wrapper a" ) );
        var currSigIdx = 0, j, numSigIdxEls, currHeaderEl, currHeaderData;
        var headerIdx = 0; // index of the current header
        var headerLvl = 0; // level of the current header
        for( j = 0, numSigIdxEls = sigIdxEls.length; j < numSigIdxEls; j++ ) {
            var headerTagNameMatch = /^h(\d+)$/.exec(
                sigIdxEls[j].tagName.toLowerCase() );
            if( headerTagNameMatch ) {
                currHeaderEl = sigIdxEls[j];

                // Test to make sure we're not in the table of contents
                if( currHeaderEl.parentNode.className === "toctitle" ) {
                    continue;
                }

                // Reset signature counter
                currSigIdx = 0;

                // Dig down one level for the header text because
                // MW buries the text in a span inside the header
                var headlineEl = null;
                if( currHeaderEl.childNodes[0].className &&
                    currHeaderEl.childNodes[0].className.indexOf( "mw-headline" ) >= 0 ) {
                    headlineEl = currHeaderEl.childNodes[0];
                } else {
                    for( var i = 0; i < currHeaderEl.childNodes.length; i++ ) {
                        if( currHeaderEl.childNodes[i].className &&
                                currHeaderEl.childNodes[i].className
                                .indexOf( "mw-headline" ) >= 0 ) {
                            headlineEl = currHeaderEl.childNodes[i];
                            break;
                        }
                    }
                }

                var headerName = null;
                if( headlineEl ) {
                    headerName = headlineEl.textContent;
                }

                if( headerName === null ) {
                    console.error( currHeaderEl );
                    throw "Couldn't parse a header element!";
                }

                headerLvl = headerTagNameMatch[1];
                currHeaderData = [ headerLvl, headerName, headerIdx ];
                headerIdx++;
            } else {

                // Save all the metadata for this link
                currIndentation = metadata[ sigIdxEls[j].id ];
                metadata[ sigIdxEls[j].id ] = [ currIndentation,
                    currHeaderData ? currHeaderData.slice(0) : null,
                    currSigIdx ];
                currSigIdx++;
            }
        }
        //console.log(metadata);

        // Disable links inside hatnotes, archived discussions
        var badRegionsSelector = [
            "div.archived",
            "div.resolved"
            ].map( function ( s ) { return s + " .reply-link-wrapper" } ).join( "," );
        var insideArchived = mainContent.querySelectorAll( badRegionsSelector );
        for( var i = 0; i < insideArchived.length; i++ ) {
            insideArchived[i].parentNode.removeChild( insideArchived[i] );
        }
    }

    function popupForm(){
        var popUpDiv = document.createElement("div");
        popUpDiv.id = "form-popup";
        popUpDiv.style = "display: block; position: fixed; bottom: 0; right: 15px; border: 3px solid #f1f1f1; z-index: 1; background: white"
        document.body.appendChild(popUpDiv);

        // Fetching HTML Elements in Variables by ID.

        var openelement = document.createElement('input'); // Append Open Button
        openelement.setAttribute("type", "button");
        openelement.setAttribute("name", "openbutton");
        openelement.setAttribute("value", "Open");
        openelement.setAttribute("display", "none");
        openelement.setAttribute("id", "popupOpenButton");
        popUpDiv.appendChild(openelement);

        var popUpFormDiv = document.createElement("div");
        popUpFormDiv.id = "form-popup-div";
        popUpFormDiv.style = "display: block; position: fixed; padding: 200px; top: 0; bottom: 0; left: 0; right: 0; border: 3px solid #f1f1f1; z-index: 999; background: rgba(90, 90, 90, 0.5);"
        document.body.appendChild(popUpFormDiv);

        var popUpFormDiv1 = document.createElement("div");
        popUpFormDiv1.style = "display: block; position: fixed; padding: 15px; border: 3px solid #f1f1f1; background: white;"
        popUpFormDiv.appendChild(popUpFormDiv1);

        var createform = document.createElement('form'); // Create New Element Form
        //createform.setAttribute("action", "");     // Setting Action Attribute on Form
        createform.setAttribute("method", "post");    // Setting Method Attribute on Form
        //createform.setAttribute("id", "survey-form"); // Setting Method Attribute on Form
        popUpFormDiv1.appendChild(createform);

        var closeelement = document.createElement('input'); // Append Submit Button
        closeelement.setAttribute("type", "button");
        closeelement.setAttribute("name", "closebutton");
        closeelement.setAttribute("value", "Close");
        closeelement.setAttribute("id", "popupCloseButton");
        createform.appendChild(closeelement);

        var heading = document.createElement('h2'); // Heading of Form
        heading.innerHTML = "Pre-Survey Form";
        createform.appendChild(heading);

        var line = document.createElement('hr'); // Giving Horizontal Row After Heading
        createform.appendChild(line);

        var linebreak = document.createElement('br');
        createform.appendChild(linebreak);

        var ageLabel = document.createElement('label'); // Create Label for Name Field
        ageLabel.innerHTML = "Your age in year: "; // Set Field Labels
        createform.appendChild(ageLabel);

        var inputelement = document.createElement('input'); // Create Input Field for Name
        inputelement.setAttribute("type", "number");
        inputelement.setAttribute("min", "18");
        inputelement.setAttribute("max", "150");
        inputelement.setAttribute("name", "age");
        createform.appendChild(inputelement);

        var linebreak = document.createElement('br');
        createform.appendChild(linebreak);

        var emaillabel = document.createElement('label'); // Create Label for E-mail Field
        emaillabel.innerHTML = "Highest education : ";
        createform.appendChild(emaillabel);

        var eduelement = document.createElement('input'); // Create Input Field for E-mail
        eduelement.setAttribute("type", "text");
        eduelement.setAttribute("name", "edu");
        createform.appendChild(eduelement);

        var emailbreak = document.createElement('br');
        createform.appendChild(emailbreak);

        var messagelabel = document.createElement('label'); // Append Textarea
        messagelabel.innerHTML = "How many years are you using wikipedia as editor: ";
        createform.appendChild(messagelabel);

        var inputelement1 = document.createElement('input'); // Create Input Field for Name
        inputelement1.setAttribute("type", "number");
        inputelement1.setAttribute("min", "1");
        inputelement1.setAttribute("max", "100");
        inputelement1.setAttribute("name", "editHistory");
        createform.appendChild(inputelement1);

        var messagebreak = document.createElement('br');
        createform.appendChild(messagebreak);

        var submitelement = document.createElement('input'); // Append Submit Button
        submitelement.setAttribute("id", "popupSubmitButton");
        submitelement.setAttribute("type", "submit");
        submitelement.setAttribute("name", "dsubmit");
        submitelement.setAttribute("value", "Submit");
        createform.appendChild(submitelement);

        mw.util.addCSS(
            "#popUpDiv { padding: 1em; margin-left: 1.6em;} " +
            "#popupOpenButton { display: none;} "
        );

        $("#popupCloseButton" ).click(function(){
            $("#form-popup-div").fadeOut(200);
                //createform.style.display = "none";
            openelement.style.display = "block";
        });

        $( "#popupOpenButton" ).click(function(){
            $("#form-popup-div").fadeTo(200, 1);
                //createform.style.display = "block";
            openelement.style.display = "none";
        });

        $("#popupSubmitButton").click(function(){
            console.log($("input[name]='age']").val());
            console.log($("input[name='edu']").val());
            console.log($("input[name='editHistory']").val());

            // const APIURL = 'http://127.0.0.1:8000/userapi/';   

            // var data = {};
            // data.username = "TestPopupsurvey";
            // data.test_option  = 2;
            // var json = JSON.stringify(data);

            // var xhr = new XMLHttpRequest();
            // xhr.open("POST", APIURL, true);
            // xhr.setRequestHeader('Content-type','application/json; charset=utf-8');
            // xhr.onload = function () {
            //     var users = JSON.parse(xhr.responseText);
            //     if (xhr.readyState == 4 && xhr.status == "201") {
            //         console.table(users);
            //     } else {
            //         console.error(users);
            //     }
            // }
            // xhr.send(json);
        });
    }

    function onReady() {

        // Exit if history page or edit page
        if( mw.config.get( "wgAction" ) === "history" ) return;
        if( document.getElementById( "editform" ) ) return;

        api = new mw.Api();

        mw.util.addCSS(
            "#reply-link-panel { padding: 1em; margin-left: 1.6em; "+
              "max-width: 1200px; width: 66%; margin-top: 0.5em; }"+
            ".gone-on-empty:empty { display: none; }"
        );

        // Pre-load interface messages; we will check again when a (reply)
        // link is clicked
        api.loadMessages( INT_MSG_KEYS );

        // Initialize the xfdType global variable, which must happen
        // before the call to attachLinks

        // Default values for some preferences
        if( window.replyLinkAutoReload === undefined ) window.replyLinkAutoReload = true;
        if( window.replyLinkDryRun === undefined ) window.replyLinkDryRun = "never";
        if( window.replyLinkPreloadPing === undefined ) window.replyLinkPreloadPing = "always";
        if( window.replyLinkPreloadPingTpl === undefined ) window.replyLinkPreloadPingTpl = "{{u|##}}, ";
        if( window.replyLinkCustomSummary === undefined ) window.replyLinkCustomSummary = false;
        if( window.replyLinkTestInstantReply === undefined) window.replyLinkTestInstantReply = false;

        // Insert "reply" links into DOM
        //attachLinks();

        // This large string creats the "pending" texture
        window.replyLinkPendingImageUrl = "data:image/gif;base64,R0lGODlhGAAYAKIGAP7+/vv7+/Ly8u/v7+7u7v///////wAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQFAAAGACwAAAAAGAAYAAADU0hKAvUwvjCWbTIXahfWEdcxDgiJ3Wdu1UiUK5quUzuqoHzBuZ3yGp0HmBEqcEHfjmYkMZXDp8sZgx6JkiayaKWatFhJd1uckrPWcygdXrvUJ1sCACH5BAUAAAYALAAAAAAYABgAAANTSLokUDBKGAZbbupSr8qb1HlgSFnkY55eo67jVZoxM4c189IoubKtmyaH2W2IH+OwJ1NOkK4fVPhk2pwia1GqTXJbUVg3zANTs2asZHwWpX+cQQIAIfkEBQAABgAsAAAAABgAGAAAA1E4tLwCJcoZQ2uP6hLUJdk2dR8IiRL5hSjnXSyqwmc7Y7X84m21MzHRrZET/oA9V8nUGwKLGqcDSpEybcdpM3vVLYNRLrgqpo7K2685hcaqkwkAIfkEBQAABgAsAAAAABgAGAAAA1RYFUP+TgBFq2IQSstxjhNnNR+xiVVQmiF6kdnpLrDWul58o7k9vyUZrvYQ8oigHy24E/UgzQ4yonwWo6kp62dNzrrbr9YoXZEt4HPWjKWk20CmKwEAIfkEBQAABgAsAAAAABgAGAAAA1NYWjH08Amwam0xTstxlhR3OR+xiYv3nahCrmHLlGbcqpqN4hB7vzmZggcSMoA9nYhYMzJ9O2RRyCQoO1KJM9uUVaFYGtjyvY7E5hR3fC6x1WhRAgAh+QQFAAAGACwAAAAAGAAYAAADVFi6FUMwQgGYVU5Kem3WU9UtH8iN2AMSJ1pq7fhuoquaNXrDubyyvc4shCLtIjHZkVhsLIFN5yopfFIvQ2gze/U8CUHsVxDNam2/rjEdZpjVKTYjAQAh+QQFAAAGACwAAAAAGAAYAAADU1i6G0MwQgGYVU5Kem3WU9U1D0hwI1aCaPqxortq7fjSsT1veXfzqcUuUrOZTj3fEBlUmYrKZ/LyCzULVWYzC6Uuu57vNHwcM7KnKxpMOrKdUkUCACH5BAUAAAYALAAAAAAYABgAAANTWLqsMSTKKEC7b856W9aU1S0fyI0OBBInWmrt+G6iq5q1fMN5N0sx346GSq1YPcwQmLwsQ0XHMShcUZXWpud53WajhR8SLO4yytozN016EthGawIAIfkEBQAABgAsAAAAABgAGAAAA1MoUNzOYZBJ53o41ipwltukeI4WEiMJgWGqmu31sptLwrV805zu4T3V6oTyfYi2H4+SPJ6aDyDTiFmKqFEktmSFRrvbhrQoHMbKhbGX+wybc+hxAgAh+QQFAAAGACwAAAAAGAAYAAADVEgqUP7QhaHqajFPW1nWFEd4H7SJBFZKoSisz+mqpcyRq23hdXvTH10HCEKNiBHhBVZQHplOXtC3Q5qoQyh2CYtaIdsn1CidosrFGbO5RSfb35gvAQAh+QQFAAAGACwAAAAAGAAYAAADU0iqAvUwvjCWbTIXahfWEdcRHzhVY2mKnQqynWOeIzPTtZvBl7yiKd8L2BJqeB7jjti7IRlKyZMUDTGTzis0W6Nyc1XIVJfRep1dslSrtoJvG1QCACH5BAUAAAYALAAAAAAYABgAAANSSLoqUDBKGAZbbupSb3ub1HlZGI1XaXIWCa4oo5ox9tJteof1sm+9xoqS0w2DhBmwKPtNkEoN1Cli2o7WD9ajhWWT1NM3+hyHiVzwlkuemIecBAAh+QQFAAAGACwAAAAAGAAYAAADUxhD3CygyEnlcg3WXQLOEUcpH6GJE/mdaHdhLKrCYTs7sXiDrbQ/NdkLF9QNHUXO79FzlUzJyhLam+Y21ujoyLNxgdUv1fu8SsXmbVmbQrN97l4CACH5BAUAAAYALAAAAAAYABgAAANSWBpD/k4ARetq8EnLWdYTV3kfsYkV9p3oUpphW5AZ29KQjeKgfJU6ES8Su6lyxd2x5xvCfLPlIymURqDOpywbtHCpXqvW+OqOxGbKt4kGn8vuBAAh+QQFAAAGACwAAAAAGAAYAAADU1iqMfTwCbBqbTFOy3GWFHc5H7GJi/edaKFmbEuuYeuWZt2+UIzyIBtjptH9iD2jCJgTupBBIdO3hDalVoKykxU4mddddzvCUS3gc7mkTo2xZmUCACH5BAUAAAYALAAAAAAYABgAAANTWLoaQzBCAZhtT0Z6rdNb1S0fSHAjZp5iWoKom8Ht+GqxPeP1uEs52yrYuYVSpN+kV1SykCoatGBcTqtPKJZ42TK7TsLXExZcy+PkMB2VIrHZQgIAIfkEBQAABgAsAAAAABgAGAAAA1RYuhxDMEIBmFVOSnpt1lPVLR/IjdgDEidaau34bqKrmrV8w3k3RzHfjoZaDIE934qVvPyYxdQqKJw2PUdo9El1ZrtYa7TAvTayBDMJLRg/tbYlJwEAIfkEBQAABgAsAAAAABgAGAAAA1IItdwbg8gphbsFUioUZtpWeV8WiURXPqeorqFLfvH2ljU3Y/l00y3b7tIbrUyo1NBRVB6bv09Qd8wko7yp8al1clFYYjfMHC/L4HOjSF6bq80EACH5BAUAAAYALAAAAAAYABgAAANTSALV/i0MQqtiMEtrcX4bRwkfFIpL6Zxcqhas5apxNZf16OGTeL2wHmr3yf1exltR2CJqmDKnCWqTgqg6YAF7RPq6NKxy6Rs/y9YrWpszT9fAWgIAOw==";
        
        //  add new: for data collection //
        uName = mw.config.get( "wgUserName" )
        console.log(uName)

        var submitInfo = true;   // should be come from database
        
        if(uName != null){
            // Insert "reply" links into DOM
            attachLinks();
            const analyzeURL = 'http://127.0.0.1:8000/userapi/user/?user_name='+mw.config.get( "wgUserName" )+'';           // local API for userinfo
            //const analyzeURL = 'http://127.0.0.1:8000/userapi/user/?user_name=hello';           // local API for userinfo
            const x = new XMLHttpRequest();
            x.open('GET', analyzeURL);
            x.setRequestHeader('Content-Type', 'application/json');
            x.responseType = 'json';
            x.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200) {
                    if((this.response.length == 0))
                    {
                        //popupForm();
                        // var data = {};
                        // data.user_name = uName;
                        // data.study_group = 0;
                        // data.test_option  = 1;
                        // var json = JSON.stringify(data);

                        // var xhr = new XMLHttpRequest();
                        // xhr.open("POST", analyzeURL, true);
                        // xhr.setRequestHeader('Content-type','application/json; charset=utf-8');
                        // xhr.onload = function () { 
                        //     if (xhr.readyState == 4 && xhr.status == "201") {
                        //         var users = JSON.parse(xhr.responseText);
                        //         console.table(users);
                        //     } else {
                        //         console.log("not found");
                        //     }
                        // }
                        // xhr.send(json);
                    }
                    // else{
                    //     Study_group = this.response.
                    // }
                    else if(submitInfo == false){
                        //popupForm();
                    }
                    else{
                        Study_group = this.response.study_group;
                        Testoption = this.response.test_option;
                        console.log(this.response);
                    }
                }
            };
            x.send();
            //  add new: for data collection //
        }

    }

    mw.loader.load( "mediawiki.ui.input", "text/css" );
    mw.loader.using( [ "mediawiki.util", "mediawiki.api" ] ).then( function () {
        console.log("inside loader function, before calling mw.hook");
        mw.hook( "wikipage.content" ).add( onReady );
    } );
}

if( jQuery !== undefined && mediaWiki !== undefined ) {

    currentPageName = mw.config.get( "wgPageName" );

    var normalView = mw.config.get( "wgIsArticle" ) &&
            !mw.config.get( "wgDiffOldId" );

    if(currentPageName.toLocaleLowerCase().indexOf("talk")!=-1){
        console.log("This is a talk page");
        if(normalView){
            loadOptionsforCheck( jQuery, mediaWiki );
        }
    }

}
//</nowiki>