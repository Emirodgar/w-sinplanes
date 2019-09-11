---
description: Aprende a pasar correctamente de enterno a cadena y viceversa en Java.
lang: es_ES
permalink: tecnologia/pasar-de-int-a-string-y-de-string-a-int-en-java
redirect_to: https://emirodgar.com/pasar-de-int-a-string-y-de-string-a-int-en-java
author:
  twitter: emirodgar
  
---

# Pasar de INT a String y de String a INT en Java

Me llegan muchas visitas buscando el cómo poder cambiar entre varios tipos de datos en java, y ya creo que va siendo hora de que les haga un poquito de caso y explique como es posible convertir datos enteros a cadena (int a String) y cadena a enteros (String a int)  
  
Por lo general lo que más suelo hacer es pasar cadenas a enteros, es decir, de un tipo String a un tipo int, notese que "String" es un objeto e int es un tipo básico luego el proceso de uno a otro será diferente.  
  
## Pasar un STRING a un INT (de cadena a entero)  
  
Para hacer la siguiente operación necesitaremos hacer uso de la clase Integer y de su método "parseInt" de la siguiente manera:

    String numCadena = "1";      
    int numEntero = Integer.parseInt(numCadena);
¿Qué problemas podemos tener? pues que la cadena no sólo contenga números sino que venga con espacios.  
  
Si los espacios vienen al princio o al final, con un simple trim bastará para eliminarlos, por ejemplo ("1")

    numCadena.trim();

Si tenemos espacio entre los números deberíamos usar el método replaceAll (" 1 3 45 6")

    numCadena.replaceAll(" ", "");

Una vez realiazdos estos sencillos pasos podremos trabajar con los números enteros.  
  
## Pasar un INT a STRING (de entero a cadena)  
  
Para pasar de un tipo básico a un objeto String tenemos varias posibilidades, por un lado, si eres un artesano, puedes simplemente concatenar a tu entero una cadena vacía:

    int numEntero = 4;    
    String numCadena= numEntero+"";

La forma correcta de realizar esta operación sería invocando al método valueOf de la clase String  
  

    int numEntero = 4;    
    String numCadena= String.valueOf(numEntero);

Otra forma correcta de hacerlo sería utilizando el método toString del objeto Integer de la siguiente manera:

    String numCadena= Integer.toString(numEntero);

Espero que esto les sirva a todas aquellas personas que vinieron buscándolo, al menos así es como suelo hacerlo.
<!--stackedit_data:
eyJoaXN0b3J5IjpbNjM0NjUwNTEwXX0=
-->
