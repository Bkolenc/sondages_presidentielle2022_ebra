function click_candidats()
{
    // A faire :
    // - Placer la tooltip à gauche ou à droite en fonction de la position de la souris par rapport au milieu de l'écran
    // - Styler la popup
    d3.selectAll(".candidat").on("click", null).on("click", function(e){
        
        
        var id = this.getAttribute("data-id"); 
        var selection = G_sondages.selection_candidats;
        tooltip(e.pageX, e.pageY, G_sondages.tables.candidats[id].nom_candidat);
        if(!inArray(id, selection))
        {
            G_sondages.selection_candidats.push(id);
        }
        else
        {
            G_sondages.selection_candidats = G_sondages.selection_candidats.filter(function(item){
                return item !== id;
            });
        }
        console.log(G_sondages.selection_candidats);
        maj_boutons_candidats();
    })
    .on("mousemove", null).on("mousemove", function(e){
        var id = this.getAttribute("data-id"); 
        tooltip(e.pageX, e.pageY, G_sondages.tables.candidats[id].nom_candidat);
    });
    
    
    
    
    d3.select("html").on("click mouseover", null).on("click mouseover", function(e){
        
        check_si_click_hors_bouton(e);
        
    });

    function tooltip(x, y, candidat)
    {
        clearTimeout(G_sondages.vrac.tooltip_to);
        d3.select("#tooltip")
            .style("display","block")
            .style("left", x+20+"px")
            .style("top", y+20+"px")
            .text(candidat);

        G_sondages.vrac.tooltip_to = setTimeout(function(){
            d3.select("#tooltip").style("display","none");
        },1000)
    }

    function check_si_click_hors_bouton(e)
    {
        var classe = e.target.getAttribute("class");
        if(classe == "img_cont" || classe == "initiales" || classe=="candidat")
        {
            // do nothing
        }
        else
        {
            d3.select("#tooltip").style("display","none");
        }
    }
    
    d3.select("#plus_de_candidats").on("click", null).on("click", function(){
        var deploye = d3.select("#tier_2").attr("data-deploye");
       // console.log(deploye);
        if(deploye == "false")
        {
            d3.select("#tier_2").style("display", "block")
                .attr("data-deploye", true);
            d3.select("#plus_de_candidats").text("Moins de candidats");
        }
        else
        {
            d3.select("#tier_2").style("display", "none")
                .attr("data-deploye", false);
            d3.select("#plus_de_candidats").text("Plus de candidats");
        }
        
    });
}







