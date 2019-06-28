---
description: Función JavaScript para validar fechas
lang: es_ES
permalink: tecnologia/funcion-javascript-para-validar-fechas
redirect_to: https://emirodgar.com/funcion-javascript-para-validar-fechas
  
---
# Función javascript para validar fechas

Esta función en Javascript nos permitirá de una forma rápida validar una fecha. Devolverá true o false dependiendo de si es correcta o no. Para que sea más reutilizable, la fecha se le pasará como parámetro.  
  
Esta función valida que el formato introducido sea dd/mm/yyyy, aunque se puede modificar de una forma sencilla.  
  
Valida que todos los parámetros introducidos a excepción de las barras de separación ?/? sean números.  
  
También valida que el día y el mes se correspondan entre ellos, por ejemplo, en Abril no permitir introducir días mayores de 30.  
  
Esta función también tiene en cuenta que cada 4 años es bisiesto.

    function validarFecha(fecha) {  
      
     try{        
     var fecha = fecha.split("/");        
     var dia = fecha[0];        
     var mes = fecha[1];        
     var ano = fecha[2];        
     var estado = true;  
      
     if ((dia.length == 2) && (mes.length == 2) && (ano.length == 4)) {        
	     switch (parseInt(mes)) {        
		     case 1:dmax = 31;break;        
		     case 2: if (ano % 4 == 0) dmax = 29; else dmax = 28;        
		     break;        
		     case 3:dmax = 31;break;        
		     case 4:dmax = 30;break;        
		     case 5:dmax = 31;break;        
		     case 6:dmax = 30;break;        
		     case 7:dmax = 31;break;        
		     case 8:dmax = 31;break;        
		     case 9:dmax = 30;break;        
		     case 10:dmax = 31;break;       
		     case 11:dmax = 30;break;      
		     case 12:dmax = 31;break;       
	     }  
           
	     dmax!=""?dmax:dmax=-1;if ((dia >= 1) && (dia <= dmax) && (mes >= 1) && (mes <= 12)) {        
	     for (var i = 0; i < fecha[0].length; i++) {         
		     diaC = fecha[0].charAt(i).charCodeAt(0);        
		     (!((diaC > 47) && (diaC < 58)))?estado = false:'';       
		     mesC = fecha[1].charAt(i).charCodeAt(0);        
		     (!((mesC > 47) && (mesC < 58)))?estado = false:'';       
	     }  
      
     } for (var i = 0; i < fecha[2].length; i++) {  
      
     anoC = fecha[2].charAt(i).charCodeAt(0);  
      
     (!((anoC > 47) && (anoC < 58)))?estado = false:'';        
     }} else estado = false;        
     return estado;    
         
    }catch(err){  
     alert("Error fechas");    
}
<!--stackedit_data:
eyJoaXN0b3J5IjpbNjQxNDI0ODI4XX0=
-->
