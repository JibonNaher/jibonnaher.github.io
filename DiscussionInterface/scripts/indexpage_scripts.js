function next1buttonClicked(){
  var un = $("#uname").val();
  console.log(un);
  if (!un.trim()){
    $("#uname").focus();
    //fetch('resources/test.txt').then(response => response.text()).then(text => console.log(text))
    window.alert("Please write a temporary username.");
  }
  else{

    var today = new Date();
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    localStorage.username = un+"_"+time;

    window.location.href='presurveypage.html';
  }
}