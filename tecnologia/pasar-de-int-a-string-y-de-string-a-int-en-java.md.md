---
description: Aprende a pasar correctamente de enterno a cadena y viceversa en Java.
lang: es_ES
permalink: tecnologia/pasar-de-int-a-string-y-de-string-a-int-en-java
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

<!--stackedit_data:
eyJoaXN0b3J5IjpbLTU2MTcwNDIzMF19
-->