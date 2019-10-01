var ans1, ans2, ans3, ans4;

$(document).on('input', '#postsurveyslider1', function() {
    $('#postsurveyslider1_value').html( "(Current selection: "+$(this).val()+")");
    ans1 = $(this).val();
});

$(document).on('input', '#postsurveyslider2', function() {
    $('#postsurveyslider2_value').html("(Current Selection: "+$(this).val()+")");
    ans2 = $(this).val();
});

$(document).on('input', '#postsurveyslider3', function() {
    $('#postsurveyslider3_value').html("(Current Selection: "+$(this).val()+")");
    ans3 = $(this).val();
});

$(document).on('input', '#postsurveyslider4', function() {
    $('#postsurveyslider4_value').html("(Current Selection: "+$(this).val()+")");
    ans4 = $(this).val();
});

function next2buttonClicked(){

    firebase.firestore().collection(`${localStorage.username}`).doc('presurvey').set({
      answer1: ans1,
      answer2: ans2,
      answer3: ans3,
      answer4: ans4
    }).catch(function(error) {
      console.error('Error writing new message to Firebase Database', error);
    });

    window.location.href='discussionPage.html';
}