package config

import (
	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"

	"log"
)

type Config struct {
	AppName           string `env:"APP_NAME"`
	SubscriptionTitle string `env:"SUBSCRIPTION_TITLE"`
	DescriptionText   string `env:"DESCRIPTION_TEXT"`
	Port              string `env:"PORT" envDefault:"55000"`
	Configs           string `env:"CONFIGS"`
	Logs              string `env:"LOGS"`
	SubPath           string `env:"SUB_PATH"`
	Sources           string `env:"SOURCES"`
}

func GetConfig() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("Info: No .env file found, falling back to system environment variables")
	}

	var cfg Config
	if err := env.Parse(&cfg); err != nil {
		log.Fatalf("Fatal: failed to parse config: %v", err)
	}

	return &cfg
}
