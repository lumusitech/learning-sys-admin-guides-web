variable "docker_host" {
  description = "Socket de Docker que usa el provider."
  type        = string
  default     = "unix:///var/run/docker.sock"
}

variable "web_port" {
  description = "Puerto del host para el contenedor web."
  type        = number
  default     = 8088
}

variable "container_name" {
  description = "Nombre del contenedor gestionado."
  type        = string
  default     = "iac-web"
}
