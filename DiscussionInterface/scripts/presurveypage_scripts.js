function next2buttonClicked(){
    // add code for data collection //

    var gender = $('input[name=gender]:checked').val();
    var age = $('input[name=age]').val();

    var presurveydata = [
        { gender: gender, age: age }
    ];

    var index = ""+new Date().getTime();

    // database.ref('users/' + localStorage.username).set({
    //     presurvey: presurveydata
    // });

    firebase.firestore().collection(localStorage.username).doc(index).set({
        presurvey: presurveydata
    }).catch(function(error) {
    console.error("Error writing new message to Firebase Database", error);
    });

    // firebase.database().ref(`$localStorage.username/feedback/`).push({
    //     presurveydata
    // });

    window.location.href='discussionpage.html';
}