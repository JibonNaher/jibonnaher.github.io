var DOWNVOTE_ON = "./resources/downvote_on.png";
var DOWNVOTE_OFF = "./resources/downvote.png";
var UPVOTE_ON = "./resources/upvote_on.png";
var UPVOTE_OFF = "./resources/upvote.png";
var REPORT_ON = "./resources/flag_on.png";
var REPORT_OFF = "./resources/flag.png";

var REPORT_ON_RGB = "rgb(240, 108, 9)";
var REPORT_OFF_RGB = "rgb(155, 155, 155)";

var REPLY_COLOR = "#16A085";
var CANCEL_COLOR = "#F06C09";

var STANDARD_USER = "0444";
var currentCommentNum = 5;
var currentReplyNum = 1;

// Change the variables below to set your task.
var interventionTask = true;
var interventionComplete = false;

var surveyTask = true;
var surveyComplete = false;

var surveyTask2 = true;
var survey2Complete = false;

var selectedIntervention = null; // The selected intervention will update in the "chooseIntervention" function.
//possibleInterventions = ["highpos", "lowpos", "highneg", "lowneg", "control"];
possibleInterventions = ["highpos"];


var SURVEY_FILE_LOCATION = "../surveys/wordunscramblesurvey.html";
var SURVEY_WIDTH = "580px";
var SURVEY_HEIGHT = "470px";

var MAX_INTERVENTIONS_ATTEMPTED = 100000; //Change this to change number of interventions to attempt.

localStorage.setItem("commentComplete", "not_complete");

//            add new items         //
var currentScore = 0;
var comment_number = 0;

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function cleanResource(resource) {
  return resource.replace("./resources/", '');
}

function next3buttonClicked(){
  // add code for data collection //
  window.location.href='postsurveypage.html';
}

function getUTCDate(){
  var date = new Date(Date.now());
  var UTCdate = date.getUTCFullYear() + '-' +
  ('00' + (date.getUTCMonth() + 1)).slice(-2) + '-' +
  ('00' + date.getUTCDate()).slice(-2) + ' ' +
  ('00' + date.getUTCHours()).slice(-2) + ':' +
  ('00' + date.getUTCMinutes()).slice(-2) + ':' +
  ('00' + date.getUTCSeconds()).slice(-2);
  console.log(UTCdate)

  return UTCdate;
}

$(document).on('click','#modellink', function(){
  var UTCdate = getUTCDate();

  firebase.firestore().collection(`${localStorage.username}`).doc(`${UTCdate}`).set({
    action: "click on the perspectiveAPI link"
  }).catch(function(error) {
    console.error('Error writing new message to Firebase Database', error);
  });
});

$(document).on('click','.forclick',function(){
  currentScore = 0;
  $("#comment-textarea-1").val($(this).text());
  $("#hideDiv").css("visibility", "hidden");
  $("#scoreP").text("I think the toxicity score in the text is: ");

  firebase.firestore().collection(`${localStorage.username}`).doc('presurvey').set({
    capital: true
  }, { merge: true }).catch(function(error) {
    console.error('Error writing new message to Firebase Database', error);
  });

  //var index = new Date().getTime()
  var UTCdate = getUTCDate();

  firebase.firestore().collection(`${localStorage.username}`).doc(`${UTCdate}`).set({
    action: "click on the exploration text",
    text: $(this).text()
  }).catch(function(error) {
    console.error('Error writing new message to Firebase Database', error);
  });

});

function delay(callback, ms) {
  var timer = 0;
  return function() {
    var context = this, args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () {
      callback.apply(context, args);
    }, ms || 0);
  };
}

function disableF5(e) { if ((e.which || e.keyCode) == 116 || (e.which || e.keyCode) == 82) e.preventDefault(); };

$(function() {

  //$(document).on("keydown", disableF5);

  $('[data-toggle="tooltip"]').tooltip();

  $('#comment-textarea').keyup(delay(function (e) {
    console.log('Time elapsed!', this.value);

    const analyzeURL = 'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=AIzaSyAXBN-B4-kxdC0wG9IJWaLNDonVIY_Ei8M';
    const x = new XMLHttpRequest();
    var msg = $("#comment-textarea").val() || ".";

    const composedComment = `{comment: {text: "${msg}"},
        languages: ["en"],
        requestedAttributes: {TOXICITY:{}} }`;
    x.open('POST', analyzeURL, true);
    x.setRequestHeader('Content-Type', 'application/json');
    x.responseType = 'json';
    x.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
          //scoretext = $("#scoreP").text();

          currentScore = this.response.attributeScores.TOXICITY.summaryScore.value;
          currentScore = currentScore.toFixed(2);
          //scoretext = +(currentScore)+"%";

          if(currentScore < 0.4){
            $("#emojiSpan").html("😌");
            $("#scoreSpan").text(currentScore);
            $("#description").css("visibility", "visible");
          }
          else if(currentScore > 0.4 &&  currentScore < 0.7){
            $("#emojiSpan").html("🤔");
            $("#scoreSpan").text(currentScore);
            $("#description").css("visibility", "visible");
          }
          else{
            $("#emojiSpan").html("😢");
            $("#scoreSpan").text(currentScore);
            $("#description").css("visibility", "visible");
          }

          console.log(currentScore);
        };
    };
    x.send(composedComment);

    // add in the database //
    var UTCdate = getUTCDate();
    firebase.firestore().collection(`${localStorage.username}`).doc(`${UTCdate}`).set({
      action: "current version of typed comment",
      text: msg,
      score: currentScore
    }).catch(function(error) {
      console.error('Error writing new message to Firebase Database', error);
    });

  }, 450));
});

$(document).on('input', '#slider', function() {
  $('#slider_value').html( $(this).val()+"%" );
});

function resetButtons(){
  currentScore = 0;
  $("#hideDiv").css("visibility", "hidden");
  $("#scoreP").text("I think the toxicity score in the text is: ");
  var msg = $("#comment-textarea-1").val() || ".";

  // add in the database //
  var UTCdate = getUTCDate();
  firebase.firestore().collection(`${localStorage.username}`).doc(`${UTCdate}`).set({
    action: "change text in the exploration bar",
    text: msg
  }).catch(function(error) {
    console.error('Error writing new message to Firebase Database', error);
  });

}

function findScore() {
  $("#hideDiv").css("visibility", "hidden");
  $("#scoreP").css("visibility", "hidden");
  const analyzeURL = 'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=AIzaSyAXBN-B4-kxdC0wG9IJWaLNDonVIY_Ei8M';
  const x = new XMLHttpRequest();
  var msg = $("#comment-textarea-1").val() || ".";

  const composedComment = `{comment: {text: "${msg}"},
      languages: ["en"],
      requestedAttributes: {TOXICITY:{}} }`;
  x.open('POST', analyzeURL, true);
  x.setRequestHeader('Content-Type', 'application/json');
  x.responseType = 'json';
  x.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      //scoretext = $("#scoreP").text();

      currentScore = this.response.attributeScores.TOXICITY.summaryScore.value;
      currentScore = currentScore.toFixed(2);
      //scoretext = "I think the toxicity score in the text is:  "+(currentScore*100)+"%";
      scoretext = "I think the toxicity score in the text is:  "+currentScore;
      $("#scoreP").text(scoretext);
      $("#scoreP").css("visibility", "visible");
      if(currentScore < 0.4){
        $("#infoSpan").text("(It seems the language in the comment is likely to perceived as civil to thers. Keep it up!!)");
        $("#infoDiv").css("background-color","#AACBC8");
      }
      else if(currentScore > 0.4 &&  currentScore < 0.7){
        $("#infoSpan").text("(I am not sure whether the text can be perceived as toxic to others.Maybe you can give your opinion!!)");
        $("#infoDiv").css("background-color","#D4D6B5");
      }
      else{
        $("#infoSpan").text("(It looks like the comment has language others might consider disrespectful or rude. Please be respectful and criticize ideas, not people!!)");
        $("#infoDiv").css("background-color","#D6BEB6");
      }

      $("#hideDiv").css("visibility", "visible");
      $("#hideDiv1").css("visibility", "hidden");
    };

    // add in the database //
    var UTCdate = getUTCDate();
    firebase.firestore().collection(`${localStorage.username}`).doc(`${UTCdate}`).set({
      action: "check score in the exploration bar",
      text: msg,
      score: currentScore
    }).catch(function(error) {
      console.error('Error writing new message to Firebase Database', error);
    });

  };
  x.send(composedComment);
}

function feedback(){
  var msg = $("#comment-textarea").val();
  var userScore = $('#slider').val();
  var userScoreReason = $("#userScoreReason").val();
  var otherOption = $("#otherOption").val();
  var favorite = "";
  $.each($("input[name='option']:checked"), function(){
      favorite+= $(this).val()+",";
  });

  var data = [
     ['OriginalMessage', msg],
     ['MLScore', currentScore],
     ['userScore', userScore],
     ['userScoreReason', userScoreReason],
     ['otherOption', otherOption],
     ['favorite', favorite]
  ];

  var index = new Date().getTime()
  firebase.firestore().collection(`${localStorage.username}`).doc(`${index}`).set({
    OriginalMessage: msg,
    MLScore: currentScore,
    userScore: userScore,
    userScoreReason: userScoreReason,
    otherOption: otherOption,
    favorite: favorite
  }).catch(function(error) {
    console.error('Error writing new message to Firebase Database', error);
  });

  // var csv = 'Name,Title\n';
  // data.forEach(function(row) {
  //         csv += row.join(',');
  //         csv += "\n";
  // });

  // console.log(csv);
  // var hiddenElement = document.createElement('a');
  // hiddenElement.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
  // hiddenElement.target = '_blank';
  // var today = new Date();
  // var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
  // hiddenElement.download = time+'.csv';
  // hiddenElement.click();
}

function buttonClicked(buttonType, callerObject) {
  if (buttonType==="downvote") {
    fireDownvote(callerObject);
  } else if (buttonType==="upvote") {
    fireUpvote(callerObject);
  } else if (buttonType==="report") {
    fireReport(callerObject);
  } else if (buttonType==="reply") {
    fireReply(callerObject);
  } else if (buttonType==="comment-submit") {
    fireComment(callerObject);
  } else if (buttonType==="reply-submit") {
    fireReplySubmit(callerObject);
  }
}

// https://stackoverflow.com/questions/12409299/how-to-get-current-formatted-date-dd-mm-yyyy-in-javascript-and-append-it-to-an-i#12409344
function getDate() {
  var today = new Date();
  
  //https://stackoverflow.com/questions/9070604/how-to-convert-datetime-from-the-users-timezone-to-est-in-javascript
  //EST
  offset = -5.0
  utc = today.getTime() + (today.getTimezoneOffset() * 60000);
  serverDate = new Date(utc + (3600000*offset));
  
  return serverDate.toLocaleString([], {day:'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute:'2-digit'}).replace(",", "") + " EST";
}

function fireDownvote(callerObject) {
    var elements = callerObject.getElementsByTagName("IMG");
    var elem = elements[0];
    var elemID = elem.id;
    var counterpartID = elemID.replace('downvote', 'upvote');
    var counterpartElem = document.getElementById(counterpartID);

    if (elem.src.includes(cleanResource(DOWNVOTE_ON))) {
      elem.src = DOWNVOTE_OFF;
    } else {
      elem.src = DOWNVOTE_ON;
      counterpartElem.src = UPVOTE_OFF;
    }
}

function fireUpvote(callerObject) {
    var elements = callerObject.getElementsByTagName("IMG");
    var elem = elements[0];
    var elemID = elem.id;
    var counterpartID = elemID.replace('upvote', 'downvote');
    var counterpartElem = document.getElementById(counterpartID);

    if (elem.src.includes(cleanResource(UPVOTE_ON))) {
      elem.src = UPVOTE_OFF;
    } else {
      elem.src = UPVOTE_ON;
      counterpartElem.src = DOWNVOTE_OFF;
    }

    return elemID
}

function fireReport(callerObject) {
    var elements = callerObject.getElementsByTagName("IMG");
    var elem = elements[0];
    var elemID = callerObject.id;

    if (elem.src.includes(cleanResource(REPORT_ON))) {
      elem.src = REPORT_OFF;
    } else {
      elem.src = REPORT_ON;
    }

    return elemID
}

function fireReply(callerObject) {
  var elemID = callerObject.id;
  var counterpartID = elemID.replace('reply-button', 'reply-area');

  var replyArea = document.getElementById(counterpartID);

  var replyVis = replyArea.style.visibility
  if (replyVis === 'hidden' || replyVis==="") {
    replyArea.style.visibility = 'visible';
    replyArea.style.display = 'flex';
    callerObject.innerHTML = "Cancel";
    callerObject.style.color = CANCEL_COLOR;
  } else {
    replyArea.style.visibility = 'hidden';
    replyArea.style.display = 'none';
    callerObject.innerHTML = "Reply";
    callerObject.style.color = REPLY_COLOR;
  }

  return elemID

}

function fireReplySubmit(callerObject) {
  var elemID = callerObject.id;
  var counterpartID = elemID.replace("reply-submit-button-", "comment");
  var textAreaID = elemID.replace("reply-submit-button", "reply-textarea");
  var counterpartElem = document.getElementById(counterpartID);

  var replyTextArea = document.getElementById(textAreaID);
  var replyText = replyTextArea.value;

  if (isIllegalString(replyText)) {
    return;
  }

  var replyHTML = `
  <div id="replyComNum" class="reply-submission">
    <div class="comment-username user-username">User UserNum   <a>(Just now)</a></div>
    <div class="comment-text">ComText</div>
    <div class="comment-interactions secondary-interactions">
      <button id="downvote-button-ComNum" class="response-button" onclick="buttonClicked('downvote', this);">
        <img id="downvote-comment-icon-ComNum" class="button-icon" src='./resources/downvote.png'>Downvote</button>
      <button id="upvote-button-ComNum" class="response-button" onclick="buttonClicked('upvote', this);">
        <img id="upvote-comment-icon-ComNum" class="button-icon" src='./resources/upvote.png'>Upvote</button>
    </div>
    <div class="comment-spacer"> </div>
  </div>
  `

  replyHTML = replyHTML.replace(new RegExp("UserNum", "g"), STANDARD_USER);
  replyHTML = replyHTML.replace(new RegExp("ComNum", "g"), currentReplyNum.toString());
  var date = new Date();

  //replyHTML = replyHTML.replace(new RegExp("DateAndTime", "g"), getDate());
  replyHTML = replyHTML.replace(new RegExp("ComText", "g"), replyText);

  // Add Comment
  counterpartElem.innerHTML = counterpartElem.innerHTML + replyHTML;

  replyTextArea.value = '';

  var replyButtonID = elemID.replace("reply-submit-button", "reply-button");
  var replyButton = document.getElementById(replyButtonID);
  replyButton.innerHTML = "Reply";
  replyButton.style.color = REPLY_COLOR;

  fireReply(replyButton);
  return elemID;
}

function fireComment(callerObject) {

  var commentText = makeComment();
  comment_number++;
  if(comment_number > 1){
    $("#discussionPagenextBtn").css("visibility", "visible");
  }

  var UTCdate = getUTCDate();
  firebase.firestore().collection(`${localStorage.username}`).doc(`${UTCdate}`).set({
    action: "submit comment",
    comment_number: comment_number,
    text: commentText
  }).catch(function(error) {
    console.error('Error writing new message to Firebase Database', error);
  });

  //   divide into parts of texts and calculate the score //
  var separators = [",",".","?"];
  //var split_text = commentText.split(new RegExp(separators.join('|')));​​​​​​​​​​​​​​​​​
  var split_text = commentText.split(/,|.|?/)
  console.log("split text: ", split_text);
}


function unhideSecondaryInteractions() {
  var elems = document.getElementsByClassName("secondary-interactions");

  for (var i=0; i<elems.length; i++) {
    elems[i].style.display = 'block';
    elems[i].style.visibility = 'visible';
  }
}

function makeComment() {
  var commentTextArea = document.getElementById("comment-textarea");
  var commentText = commentTextArea.value.trim();

  console.log("insode makeComment() function");
  // Check if the comment is legal.
  if (isIllegalString(commentText)) {
    return;
  }

  // firebase.database().ref(`/comments/`).push({
  //     commentText
  // });

  // cmn += 1;
  // avgi = avgscore;

  var commentHTML = `
  <div id="commentComNum" class="comment-box user-comment">
    <div class="comment-username user-username">User UserNum   <a>(Just now)</a></div>
    <div class="comment-text">ComText</div>
    <!--<div class="comment-interactions secondary-interactions">
      <button id="downvote-button-ComNum" class="response-button" onclick="buttonClicked('downvote', this);">
        <img id="downvote-comment-icon-ComNum" class="button-icon" src='./resources/downvote.png'>Downvote</button>
      <button id="upvote-button-ComNum" class="response-button" onclick="buttonClicked('upvote', this);">
        <img id="upvote-comment-icon-ComNum" class="button-icon" src='./resources/upvote.png'>Upvote</button>
    </div>--!>
    <div class="comment-spacer"> </div>
  </div>
  `


  commentHTML = commentHTML.replace(new RegExp("UserNum", "g"), STANDARD_USER);
  commentHTML = commentHTML.replace(new RegExp("ComNum", "g"), currentCommentNum.toString());
  var date = new Date();

  //commentHTML = commentHTML.replace(new RegExp("DateAndTime", "g"), getDate());
  commentHTML = commentHTML.replace(new RegExp("ComText", "g"), commentText);

  // Add Comment
  commentSection = document.getElementById("comment-section");
  commentSection.innerHTML = commentSection.innerHTML + commentHTML;

  // Increment Comment Number
  currentCommentNum += 1;

  // Empty text area
  commentTextArea.value = "";

  // Show rest of the page;
  unhideSecondaryInteractions();

  localStorage.setItem("commentComplete", "complete");

  return commentText
}


function isEmpty (input) {
  if (input === "") {
    alert("Empty comments are not allowed.");
    return true;
  }
}

function containsIllegalCharacter (input) {
  if (input.includes("<") || input.includes(">")) {
    alert("Cannot use '<' or '>' characters in your comments!");
    return true;
  }
}

function isIllegalString(input) {
  if(isEmpty(input) || containsIllegalCharacter(input)) {
    return true;
  }
}

function sendfeedback() {

  var slider = document.getElementById("myRange");
  var score = slider.value;

  var feedbackcomment = document.getElementById("feedback");
  var commentText = feedbackcomment.value.trim();

  firebase.database().ref(`/feedback/`).push({
    score, commentText
  });

  feedbackcomment.value="";
  slider.value=1;
  document.getElementById("user_score").innerHTML="";
}
