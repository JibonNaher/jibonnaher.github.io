function submitConsent(){
    // add code for data collection //

    var choice = $('input[name=choice]:checked').val();
    var un = $("#un").val();

    console.log(choice, un)
    if(un == ""){
      $("#un").focus();
    //fetch('resources/test.txt').then(response => response.text()).then(text => console.log(text))
      window.alert("Please input your reddit username.");
    }
    else{
        UTCdate = getUTCDate();
        un_Time = un+"_"+UTCdate
        firebase.firestore().collection(`${un_Time}`).doc('choice').set({
            choice: choice,
            un: un
        }).catch(function(error) {
            console.error('Error writing new message to Firebase Database', error);
        }).then(() => {
            window.location.href='Information page.pdf';
        })
    }
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


  function submitConsentandPrint(){
    var choice = $('input[name=choice]:checked').val();
    var un = $("#un").val();

    console.log(choice, un)
    if(un == ""){
      $("#un").focus();
    //fetch('resources/test.txt').then(response => response.text()).then(text => console.log(text))
      window.alert("Please input your reddit username.");
    }
    else{
        UTCdate = getUTCDate();
        un_Time = un+"_"+UTCdate
        firebase.firestore().collection(`${un_Time}`).doc('choice').set({
            choice: choice,
            un: un
        }).catch(function(error) {
            console.error('Error writing new message to Firebase Database', error);
        }).then(() => {
           // window.location.href='Information page.pdf';
           window.print();
        })
    }
  }