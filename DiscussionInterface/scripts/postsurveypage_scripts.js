//     Collect overall_transparency answers 
var overall_transparency_ans1, overall_transparency_ans2, overall_transparency_ans3, overall_transparency_ans4;
$(document).on('input', '#postsurveyslider1', function() {
    $('#postsurveyslider1_value').html( "(Current selection: "+$(this).val()+")");
    overall_transparency_ans1 = $(this).val();
});
$(document).on('input', '#postsurveyslider2', function() {
    $('#postsurveyslider2_value').html("(Current Selection: "+$(this).val()+")");
    overall_transparency_ans2 = $(this).val();
});
$(document).on('input', '#postsurveyslider3', function() {
    $('#postsurveyslider3_value').html("(Current Selection: "+$(this).val()+")");
    overall_transparency_ans3 = $(this).val();
});
$(document).on('input', '#postsurveyslider4', function() {
    $('#postsurveyslider4_value').html("(Current Selection: "+$(this).val()+")");
    overall_transparency_ans4 = $(this).val();
});

//     Collect transparency_1_participative answers 
var transparency_1_participative_ans1, transparency_1_participative_ans2, transparency_1_participative_ans3, transparency_1_participative_ans4, transparency_1_participative_ans5;
$(document).on('input', '#postsurveyslider5', function() {
    $('#postsurveyslider5_value').html("(Current Selection: "+$(this).val()+")");
    transparency_1_participative_ans1 = $(this).val();
});
$(document).on('input', '#postsurveyslider6', function() {
    $('#postsurveyslider6_value').html("(Current Selection: "+$(this).val()+")");
    transparency_1_participative_ans2 = $(this).val();
});
$(document).on('input', '#postsurveyslider7', function() {
    $('#postsurveyslider7_value').html("(Current Selection: "+$(this).val()+")");
    transparency_1_participative_ans3 = $(this).val();
});
$(document).on('input', '#postsurveyslider8', function() {
    $('#postsurveyslider8_value').html("(Current Selection: "+$(this).val()+")");
    transparency_1_participative_ans4 = $(this).val();
});
$(document).on('input', '#postsurveyslider9', function() {
    $('#postsurveyslider9_value').html("(Current Selection: "+$(this).val()+")");
    transparency_1_participative_ans5 = $(this).val();
});

//     Collect transparency_2_information answers 
var transparency_2_information_ans1, transparency_2_information_ans2, transparency_2_information_ans3, transparency_2_information_ans4, transparency_2_information_ans5, transparency_2_information_ans6;
$(document).on('input', '#postsurveyslider10', function() {
    $('#postsurveyslider10_value').html("(Current Selection: "+$(this).val()+")");
    transparency_2_information_ans1 = $(this).val();
});
$(document).on('input', '#postsurveyslider11', function() {
    $('#postsurveyslider11_value').html("(Current Selection: "+$(this).val()+")");
    transparency_2_information_ans2 = $(this).val();
});
$(document).on('input', '#postsurveyslider12', function() {
    $('#postsurveyslider12_value').html("(Current Selection: "+$(this).val()+")");
    transparency_2_information_ans3 = $(this).val();
});
$(document).on('input', '#postsurveyslider13', function() {
    $('#postsurveyslider13_value').html("(Current Selection: "+$(this).val()+")");
    transparency_2_information_ans4 = $(this).val();
});
$(document).on('input', '#postsurveyslider14', function() {
    $('#postsurveyslider14_value').html("(Current Selection: "+$(this).val()+")");
    transparency_2_information_ans5 = $(this).val();
});
$(document).on('input', '#postsurveyslider15', function() {
    $('#postsurveyslider15_value').html("(Current Selection: "+$(this).val()+")");
    transparency_2_information_ans6= $(this).val();
});

//     Collect transparency_3_accountability answers 
var transparency_3_accountability_ans1, transparency_3_accountability_ans2;
$(document).on('input', '#postsurveyslider16', function() {
    $('#postsurveyslider16_value').html("(Current Selection: "+$(this).val()+")");
    transparency_3_accountability_ans1 = $(this).val();
});
$(document).on('input', '#postsurveyslider17', function() {
    $('#postsurveyslider17_value').html("(Current Selection: "+$(this).val()+")");
    transparency_3_accountability_ans2= $(this).val();
});

//     Collect transparency_4_secretive answers 
var transparency_4_secretive_ans1, transparency_4_secretive_ans, transparency_4_secretive_ans3;
$(document).on('input', '#postsurveyslider18', function() {
    $('#postsurveyslider18_value').html("(Current Selection: "+$(this).val()+")");
    transparency_4_secretive_ans1 = $(this).val();
});
$(document).on('input', '#postsurveyslider19', function() {
    $('#postsurveyslider19_value').html("(Current Selection: "+$(this).val()+")");
    transparency_4_secretive_ans2= $(this).val();
});
$(document).on('input', '#postsurveyslider20', function() {
    $('#postsurveyslider20_value').html("(Current Selection: "+$(this).val()+")");
    transparency_4_secretive_ans3= $(this).val();
});

//     Collect overall_trust answers 
var overall_trust_ans1, overall_trust_ans2;
$(document).on('input', '#postsurveyslider21', function() {
    $('#postsurveyslider21_value').html("(Current Selection: "+$(this).val()+")");
    overall_trust_ans1 = $(this).val();
});
$(document).on('input', '#postsurveyslider22', function() {
    $('#postsurveyslider22_value').html("(Current Selection: "+$(this).val()+")");
    overall_trust_ans2= $(this).val();
});

//     Collect trust_1_competence answers 

//     Collect trust_2_integrity answers 

//     Collect trust_3_goodwill answers 


function next4button1Clicked(){
    $("#transparency-1-participative").css("display", "block");
    $("#overall-transparency").css("display", "none");
}

function next4button2Clicked(){
    $("#transparency-2-information").css("display", "block");
    $("#transparency-1-participative").css("display", "none");
}

function next4button3Clicked(){
    $("#transparency-3-accountability").css("display", "block");
    $("#transparency-2-information").css("display", "none");
}

function next4button4Clicked(){
    $("#transparency-4-secretive").css("display", "block");
    $("#transparency-3-accountability").css("display", "none");
}

function next4button5Clicked(){
    $("#transparency-4-secretive").css("display", "none");
    $("#overall-trust").css("display", "block");
}

function next4button6Clicked(){
    $("#trust-1-competence").css("display", "block");
    $("#overall-trust").css("display", "none");
}

function next4button7Clicked(){
    $("#trust-1-competence").css("display", "none");
    $("#trust-2-integrity").css("display", "block");
}
function next4button8Clicked(){
    $("#trust-3-goodwill").css("display", "block");
    $("#trust-2-integrity").css("display", "none");
}


function next4button9Clicked(){

    // firebase.firestore().collection(`${localStorage.username}`).doc('postsurvey').set({
    //   answer1: ans1,
    //   answer2: ans2,
    //   answer3: ans3,
    //   answer4: ans4
    // }).catch(function(error) {
    //   console.error('Error writing new message to Firebase Database', error);
    // }).then(() => {
         window.location.href='finalpage.html';
    // });
}
