function swali(data)
{
    // On tente de générer déjà la fenêtre
    d3.select("#swali").remove();
    d3.select("#fermer").remove();
    var swali = d3.selectAll("body")
        .append("div")
        .attr("id","swali").style("overflow-y","scroll")
        .style("transition","0.3s")
        .style("background-color","white")
        .style("position", "absolute")
        .style("top","0")
        .style("z-index","100000")
        .style("width","100%")
        .style("height","100vh")
        .style("left","-100%")
        .style("text-align","center");
    
    d3.select("body")
        .append("div")
        .attr("id","fermer")
        .text("X")
        .style("position","fixed")
        .style("z-index","100001")
        .style("width","30px")
        .style("height","30px")
        .style("color","white")
        .style("background-color","red")
        .style("top","20px")
        .style('right',"20px")
        .style("padding","0")
        .style("text-align", "center")
        .style("cursor","pointer");
    
    var html = "<h2 style='margin-top:10vh; margin-bottom:50px; text-align:center; width:90%;'>"+data.title+"</h2>"+data.content;
    setTimeout(function(){
        swali.html(html).style("left", 0);
    },10);
    
    d3.select("#fermer").on("click", function(){
        d3.select("#swali").style("left", "-100%");
        d3.select("#fermer").remove();
    })

//    
//    $("#swali").append("<h2 st>"+data.title+"</h2>");
//    setTimeout(function(){
//            $("#swali").append(data.content).css("left","0");
//            $("#swali p").css("max-width","500px").css("margin","auto").css("text-align","left").css("width","90%");
//        })
//    
//    $("#swali h2").css("margin-top","10vh").css("margin-bottom","50px").css("text-align","center");
//    
//    $("#fermer").off("click").on("click", function(){
//        $("#swali").css("left", "-100%");
//        $("#fermer").remove();
//    });
}