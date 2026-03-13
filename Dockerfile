# 1. Usamos una imagen de Node.js
FROM node:20

# 2. Creamos la carpeta donde vivirá la app en la nube
WORKDIR /app

# 3. Copiamos los archivos de configuración de dependencias
COPY package*.json ./

# 4. Instalamos las librerías necesarias
RUN npm install

# 5. Copiamos todo el resto de tu código a la nube
COPY . .

# 6. Ejecutamos el build de Vite (esto crea la carpeta /dist)
RUN npm run build

# 7. Exponemos el puerto estándar de Google Cloud
EXPOSE 8080

# 8. Comando para arrancar el servidor que acabamos de configurar
CMD ["npm", "start"]