function click_candidats()
{
    // A faire :
    // - Placer la tooltip à gauche ou à droite en fonction de la position de la souris par rapport au milieu de l'écran
    // - Styler la popup
    d3.selectAll(".candidat").on("click", null).on("click", function(e){
        var selected = this.getAttribute("selected");
        if(selected == null)
        {
            this.querySelector(".plus_moins").innerHTML = "-";
        }
        else
        {
            this.querySelector(".plus_moins").innerHTML = "+";
        }
        
        
        var id = this.getAttribute("data-id"); 
        var id_chiffre = +id.split("_")[1];
        var selection = G_sondages.selection_candidats;
        tooltip(e.pageX, e.pageY, G_sondages.tables.candidats[id].nom_candidat, G_sondages.credits[id]);
        if(!inArray(id, selection))
        {
            G_sondages.selection_candidats.push(id);
            Candidat.show(id_chiffre,0);
            
        }
        else
        {
            G_sondages.selection_candidats = G_sondages.selection_candidats.filter(function(item){
                return item !== id;
            });
            Candidat.hide(id_chiffre,0);
            
        }
//        console.log(G_sondages.selection_candidats );
        maj_boutons_candidats();
        
        var selected_candidats = G_sondages.selection_candidats;
        var selected_mieux = [];
        selected_candidats.forEach(function(v, k){
            selected_mieux.push(+v.split("_")[1]);
        });
//        Candidat.hide('all',0);
//        setTimeout( function(){
//            Candidat.show(selected_mieux,0);
//        });
        
    })
    .on("mousemove", null).on("mousemove", function(e){
        var id = this.getAttribute("data-id"); 
        tooltip(e.pageX, e.pageY, G_sondages.tables.candidats[id].nom_candidat, G_sondages.credits[id]);
        
    });
    
    
    
    
    d3.select("html").on("click mouseover", null).on("click mouseover", function(e){
        
        check_si_click_hors_bouton(e);
        
    });

    function tooltip(x, y, candidat, credit)
    {
        clearTimeout(G_sondages.vrac.tooltip_to);
        
        var mid_x = document.getElementsByTagName("html")[0].clientWidth / 2 ;
        console.log(mid_x);
        if(x<mid_x)
        {
            d3.select("#tooltip")
                .style("display","block")
                .style("width","150px")
                .style("text-align","center")
                .style("left", x+20+"px")
                .style("top", y+20+"px")
                .html(candidat+"<br/><span class='credit'>"+credit+"</span>");
        }
        else
        {
            d3.select("#tooltip")
                .style("display","block")
                .style("width","150px")
                .style("text-align","center")
                .style("left", (x-170)+"px")
                .style("top", (y+20)+"px")
                .html(candidat+"<br/><span class='credit'>"+credit+"</span>");
        }
        

        G_sondages.vrac.tooltip_to = setTimeout(function(){
            d3.select("#tooltip").style("display","none");
        },1000)
    }

    function check_si_click_hors_bouton(e)
    {
        var classe = e.target.getAttribute("class");
        if(classe == "img_cont" || classe == "initiales" || classe=="candidat" || classe=='plus_moins')
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

function resize(){
    var barre = document.getElementById("division_candidats").getBoundingClientRect();
    var top = barre.bottom;
    var left = barre.left;
    var width = barre.width;
    
    d3.select("#tier_2")
        .style("top",top+"px")
        .style("left", (left-10)+"px")
        .style("width", (width+20)+"px")
        .style("border", "solid lightgray 1px, solid lightgray 1px, solid lightgray 1px, solid lightgray 1px")
        .style("padding", "10px")
//        .style("padding-bottom", "5px")
        .style("border-radius","10px");

    
    var tier1 = document.getElementById("tier_1").getBoundingClientRect();
    var width_t1 = tier1.width;
    var paddingleft = (width_t1%79) / 2;
    d3.select("#tier_1").style("padding-left",paddingleft+"px");
    
    
    var tier2 = document.getElementById("tier_2").getBoundingClientRect();
    var width_t2 = tier2.width;
    var paddingleft2 = (width_t1%79) / 2;
    d3.select("#tier_2").style("padding-left",paddingleft2+10+"px");
   
}
//resize();
window.removeEventListener("resize", resize, true)
window.addEventListener('resize', resize);







