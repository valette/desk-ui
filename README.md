desk-ui
======

DESK  is a remote desktop, originally for visualization and processing of medical images. It currently only works under linux or Mac OS, but patches are welcome!

#### HTML front-end for remote desktop ####

The aim of the project is to create an HTML desktop for visualization and processing, initially designed for 3D data and medical images. Only works under linux or Mac OS, but patches are welcome!

This repository only contains the User Interface source code, mostly based on Qooxdoo and three.js. This code does not work without a backend and should not be installed alone. Instead, end-users should install either : 
* [desk for a web server hosting](https://github.com/valette/desk)
* [desk-electron for local use](https://github.com/valette/desk-electron)
* [desk-nw also for local use](https://github.com/valette/desk-nw)

#### Goals ####

The goal is to be able to use efficient visualisation tools such as THREE.js and qooxdoo on top of already existing server-side commandline programs.

Each server-side program is registered as an 'action', provided by a .json file. As an example, you can have a look at the ACVD.json file from the [ACVD repository](https://github.com/valette/ACVD)

DESK can also help to generate static content suited to release on the web. An example of static content served by a classic apache server is visible here : [http://www.creatis.insa-lyon.fr/~valette/200]([http://www.creatis.insa-lyon.fr/~valette/200])

### Infos and live demo ###

a live demo is visible here: [https://desk.creatis.insa-lyon.fr/demo/](https://desk.creatis.insa-lyon.fr/demo/)

more infos? Click here [http://www.creatis.insa-lyon.fr/site7/fr/desk](http://www.creatis.insa-lyon.fr/site7/fr/desk)


### License ###
CeCILL-B (BSD-compatible), if you use this code for academic purposes, please cite this article:

[Link to PDF](http://hal.archives-ouvertes.fr/hal-00732335) H. Jacinto, R. Kéchichan, M. Desvignes, R. Prost, and S. Valette, "A Web Interface for 3D Visualization and Interactive Segmentation of Medical Images", 17th International Conference on 3D Web Technology (Web 3D 2012), Los-Angeles, USA, pp. 51-58, 2012

Copyright (c) CNRS, INSA-Lyon, UCBL, INSERM

