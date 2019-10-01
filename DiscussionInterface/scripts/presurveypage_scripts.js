function next2buttonClicked(){
    // add code for data collection //

    var gender = $('input[name=gender]:checked').val();
    var age = $('input[name=age]').val();

    firebase.firestore().collection(`${localStorage.username}`).doc('presurvey').set({
      gender: gender,
      age: age
    }).catch(function(error) {
      console.error('Error writing new message to Firebase Database', error);
    });

    window.location.href='discussionPage.html';
}