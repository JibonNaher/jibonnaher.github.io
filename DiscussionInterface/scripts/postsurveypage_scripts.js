$(document).on('input', '#postsurveyslider1', function() {
    $('#postsurveyslider1_value').html( "(Current selection: "+$(this).val()+")");
});

$(document).on('input', '#postsurveyslider2', function() {
    $('#postsurveyslider2_value').html("(Current Selection: "+$(this).val()+")");
});