---
description: Diferentes formas para acceder y trabajar con una base de datos MySQL en remoto.
lang: es_ES
permalink: tecnologia/conectar-a-una-base-de-datos-mysql-en-remoto
  
---

# Conectar a una base de datos mysql en remoto

Últimamente me ha dado por hacer copias de seguridad de las bases de datos de mis proyectos, seguramente a raíz de que el otro día sin querer borré una, gracias a phpMyAdmin.  
  
Hasta ahora utilizaba este programa para el diseño, gestión y mantenimiento de mis bases de datos, pero desde que en el trabajo manejo el TOAD ([http://www.toadsoft.com/](http://www.toadsoft.com/)), cada día lo encuentro más sencillo y con la sensación de que no cubre todas mis expectativas, por lo que a partir de hoy he decidido empezar a usar SQLYog ([http://www.webyog.com/en/](http://www.webyog.com/en/)).  
  
El caso es que me he planteado la necesidad de realizar copias de seguridad de todas las bases de datos regularmente, y esta es otra de las razones por las que excluyo el uso de phpMyAdmin, ya que al ser vía Web requiere de un registro previo en los servidores donde estén alojados, con lo que se pierde bastante tiempo.  
  
SQLYog nos va a permitir acceder de forma organizada y rápida tanto a las bases de datos locales como a las remotas pero ¿cómo se configura una base de datos mySQL para ser accedida de forma remota? pues es muy sencillo, de momento lo he hecho para un servidor que utiliza cpanel, aunque, seguramente en otros como plesk el proceso será igual.

## Acceder remotamente a una base de datos MySQL  
  
1- Creamos una base de datos (si no la tenemos ya)  
  
2- Creamos un usuario (aconsejable que sea distinto) para el acceso remoto y le damos permisos de acceso a esa base de datos.  
  
3- Ahora iremos al menú de bases de datos y pulsaremos sobre la opción Remote mySQL.  
  
4- Ahora añadiremos una dirección IP (la nuestra) donde pone Host (% wildcard is allowed), lo suyo sería que el programa que se conecta remotamente estuviera en un servidor cuya ip no cambiara, pero como casi todas las ip son dinámicas, podemos hacer uso de %, por ejemplo, si mi dirección siempre empieza por 93, entonces pondríamos: 93.%.%.%  
  
5- Conectamos introduciendo la dirección del servidor de la base de datos, usuario, contraseña y el puerto 3306.  
  
Al principio pensé en hacerme un script PHP, pero desde luego que algo tan sencillo de configurar como esto, es mucho más rápido y eficiente, ahora sólo espero no volver a perder un solo dato jamás.  
  
Si no necesitas programas de gestión de bases de datos sino que lo que buscas es simple y llanamente un programa para hacer copias de seguridad, te recomiendo MyAutoBackup o cualquier aplicación similar que permita programas copias de seguridad.
<!--stackedit_data:
eyJoaXN0b3J5IjpbMjA5ODcyMjE5OF19
-->