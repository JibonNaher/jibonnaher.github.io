function next2buttonClicked(){
    // add code for data collection //

    var gender = $('input[name=gender]:checked').val();
    var age = $('input[name=age]').val();

    console.log(gender, age)
    if(age == ""){
      $('input[name=age]').focus();
    //fetch('resources/test.txt').then(response => response.text()).then(text => console.log(text))
      window.alert("Please input age.");
    }
    else{
      firebase.firestore().collection(`${localStorage.username}`).doc('presurvey').set({
        gender: gender,
        age: age
      }).catch(function(error) {
        console.error('Error writing new message to Firebase Database', error);
      }).then(() => {
        window.location.href='discussionPage.html';
      })
    }
}
