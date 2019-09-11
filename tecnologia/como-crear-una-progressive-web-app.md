---
description: Aprende a crear tu propia Progressive Web App (PWA) y olvídate de programar apps tradicionales en iOS o Android.
lang: es_ES
permalink: tecnologia/como-crear-una-progressive-web-app
redirect_to: https://emirodgar.com/como-crear-una-progressive-web-app
author:
  twitter: emirodgar
  
---

# Cómo crear una Progressive Web App

La revolución de los smartphone y los marketplaces de apps supuso un antes y un después en el mundo de la movilidad y las comunicaciones. Pero como todo en esta vida, sigue evolucionando y el siguiente paso son las **PWA** (*Progressive Web Apps*).

## Diferencias y ventajas entre apps nativas y PWA

Las PWA están programadas con el mismo lenguaje que una página web: **HTML, Javascript y CSS**. Por contra, las aplicaciones móviles nativas utilizan lenguajes específicos como Objective-C para iOS o Java para Android. Esto supone una de las principales ventajas de las PWA ya que **no necesitamos conocer varios lenguajes de programación** para disponer de soluciones web y mobile.

Otra ventaja la encontramos en el proceso de instalación de una app. En las nativas, se siguen varios pasos como acceso al marketplace, descarga, instalación, acceso y utilización. Por contra, las PWA reducen considerablemente el número de pasos necesarios **mejorando por tanto la conversión** asociada al uso de la aplicación.

<amp-twitter 
  width="375"
  height="472"
  layout="responsive"
  data-tweetid="864987919685001216">
</amp-twitter>

Un último punto importante es el tamaño. Las PWA están diseñadas para **operar de forma eficiente sin apenas consumir espacio** del dispositivo móvil por lo que facilitan enormemente el hecho de poder trabajar con muchas aplicaciones.   

## ¿Qué necesitamos para crear nuestra PWA?

Como he comentado con anterioridad, necesitamos conocimientos de HTML, Javascript (especialmente JSON) y CSS. Los elementos que compondrán nuestra PWA son los siguientes:

 - Fichero config.webmanifest (archivo JSON).
 - Fichero Service Worker.
 - Conexión segura HTTPS.
 - Icono para la aplicación.
 - Página en HTML (con especificaciones PWA).
 
### Fichero config.webmanifest
 
 Se trata del fichero de configuración que determinará las opciones de ejecución de nuestra aplicación. Establecemos el nombre, colores, rutas de los ficheros que utilizaremos, modos de ejecucución, etc. A continuación tenemos un ejemplo del contenido de este fichero.

```
{
  "name": "Prueba PWA",
  "short_name": "Prueba",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#ffffff",
  "background_color":"#ffffff",
  "icons": [
    {
      "src": "prueba-logo-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }]
}
```
Este fichero será referenciado desde nuestra página web a través de la siguiente instrucción. También acepta que la extensión sea .json

```
<link rel="manifest" href="/config.webmanifest">
```

### Fichero Service Worker

Este fichero se situará entre el servidor y el navegador permitiéndonos añadir una serie de funcionalidades a nuestra aplicación. Una de las más comunes -y requisito de las PWA- es ofrecer funcionalidades offline. Por ejemplo, podríamos cachear nuestra web para que fuera accesible sin conexión. Este fichero está programado en Javascript.

### Conexión HTTPS

Es requisito obligatorio que la aplicación PWA sea accedida únicamente a través de una conexión segura garantizada a través de un certificado de seguridad SSL.

### Icono para la aplicación

Al igual que cualquier app nativa instalada en nuestro móvil, necesitaremos que nuestra PWA pueda ser accedida a través de un icono, el cuál, será referenciado desde el fichero config.webmanifest.

### HTML bassado en PWA

Por último debemos incluir en nuestro código HTML las instrucciones necesarias para que se convierta en una PWA. A continuación muestro un código de ejemplo con las instrucciones mínimas.

```
<!DOCTYPE html>
<html>
<head>
  <title>Prueba PWA</title>
  <link rel="manifest" href="/manifest.webmanifest">
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#ffffff">
</head>
<body>
  <h1>PWA Minimus</h1>
  <p>Welcome to PWA Minimus, a minimal PWA.</p>
  <p>It has a service worker, a web app manifest, a single html page, and an icon.</p>
  <script>
    if('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(function() { console.log("Service worker registered"); });
    }
  </script>
</body>
</html>
```

El código anterior identifica el archivo de configuración (.manifest), registra el serviceWorker y personaliza algunas opciones de visualización como tamaño y color.

Para poder validar nuestra PWA y optimizarla al máximo, recomiendo hacer uso de [Lighthouse](https://developers.google.com/web/tools/lighthouse/run), herramienta creada por Google.

## Framework para crear tu propia PWA

Puedes utilizar el proyecto open source [PWA Builder](https://pwa.cafe/) como plataforma para la creación de forma rápida y sencilla de PWA. Bastará con instalarlo en nuestro sistema y seleccionar las características que queremos que tenga. 

## Marketplace de PWAs

Al igual que ocurre con las aplicaciones de Android o iOS, las PWA también tienen su propia página que las agrupa y nos permite acceder a ellas fácilmente. Se llama [Appsco](https://appsco.pe).
