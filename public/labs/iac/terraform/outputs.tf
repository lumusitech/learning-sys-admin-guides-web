output "url" {
  description = "URL local del servicio."
  value       = "http://localhost:${var.web_port}/"
}

output "container_id" {
  description = "ID del contenedor gestionado."
  value       = docker_container.web.id
}
