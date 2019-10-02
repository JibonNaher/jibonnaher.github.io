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

function next1buttonClicked(){
  var un = $("#uname").val();
  console.log(un);
  if (!un.trim()){
    $("#uname").focus();
    //fetch('resources/test.txt').then(response => response.text()).then(text => console.log(text))
    window.alert("Please write a temporary username.");
  }
  else{
    UTCdate = getUTCDate();
    localStorage.username = un+"_"+UTCdate;
    window.location.href='presurveypage.html';
  }
}