---
description: Blackbird en una herramienta que te ayudará a gestionar y controlar los datos que compartes con Windows
lang: es_ES
permalink: tecnologia/controla-la-privacidad-en-windows-con-blackbird
author:
  twitter: emirodgar
  
---

# Controla la privacidad en Windows con Blackbird

A raíz del escándalo de Cambridge Analytics y Facebook, la gente está mucho más concienciada respecto al **valor que tienen sus datos** y el **control que pueden o deben ejercer** sobre los mismos.

En esta tesitura entra en juego Windows, sistema operativo donde pasamos -los que lo utilizamos- la mayor parte del tiempo. Tras muchas peticiones por parte de la comunidad, Microsoft especificó [los datos que registra de sus usuarios](https://blogs.windows.com/windowsexperience/2017/04/05/windows-10-privacy-journey-continues-more-transparency-and-controls-for-you/#xoczYDMPIxzxl4QG.97) y cómo podíamos desactivar ciertas funcionalidades para evitar que fueran recopilados.

<amp-twitter 
  width="375"
  height="472"
  layout="responsive"
  data-tweetid="992146812332118016">
</amp-twitter>

Aunque no debería de ser una tarea ardua ni difícil me gustaría presentaros [Blackbird](https://www.getblackbird.net), una aplicación cuyo objetivo es **cerrar el grifo de nuestros datos a Windows** con un solo clic; más fácil imposible. 

Blackbird no es nueva ya que su origen se remota al 2016 pero se actualiza con cierta frecuencia para adaptarse a los cambios que Windows va realizando en materia de privacidad.

<amp-twitter 
  width="375"
  height="472"
  layout="responsive"
  data-tweetid="813647098868625409">
</amp-twitter>

Para reducir nuestra huella digital en Windows al mínimo podemos ejecutarla directamente (*blackbird.exe*) o a través de la consola haciendo uso de los [diversos comandos](https://www.getblackbird.net/documentation/) que se especifican en la página oficial. El objetivo será controlar qué funcionalidades y servicios queremos deshabilitar.

Para comenzar, recomiendo hacer un **análisis completo** de cara a conocer todos los puntos flojos en cuanto a privacidad que tenemos; lo haremos ejecutando el siguiente comando.

```
blackbird -scan
```

Algunos de los servicios que desactiva esta aplicación son: One Drive, Xbox Live, Anuncios del menú de inicio, Cortana, integraciones con Bing, Wi-Fi Sense, Autologgers, servicios DRM, WGA y P2P, diagnósticos internos, sincronizaciones con otros dispositivos, telemetría, etc. 
<!--stackedit_data:
eyJoaXN0b3J5IjpbMTMyMDkzODM2MF19
-->