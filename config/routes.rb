Rails.application.routes.draw do
  devise_for :users, controllers: {
    sessions: "users/sessions",
    registrations: "users/registrations",
    omniauth_callbacks: "users/omniauth_callbacks"
  }

  # Recovery code authentication
  get  "recovery_login", to: "recovery_sessions#new", as: :new_recovery_session
  post "recovery_login", to: "recovery_sessions#create", as: :recovery_session

  # Recovery codes management
  get  "recovery_codes", to: "recovery_codes#show", as: :recovery_codes
  post "recovery_codes", to: "recovery_codes#create", as: :regenerate_recovery_codes

  # Link previews
  get "link_previews", to: "link_previews#show"

  # Health check
  get "health", to: "health#show", as: :health
  get "up" => "rails/health#show", as: :rails_health_check

  # E2EE key management API
  namespace :api do
    get  "keys/:user_id", to: "keys#show", as: :user_key
    put  "keys",          to: "keys#update", as: :keys
  end

  # Registration closed landing page (shown when self-signup is disabled)
  get "registration_closed", to: "registrations_closed#show", as: :registration_closed

  # Admin namespace
  namespace :admin do
    get "/", to: "dashboard#show", as: :dashboard
    resources :users, only: [:index, :show] do
      member do
        post :lock
        post :unlock
        post :reset_password
      end
    end
    resources :rooms, only: [:index, :show, :destroy]
    resources :audit_logs, only: [:index]
    get  "system",   to: "system#show",    as: :system
    resource :settings, only: [:show, :update]
  end

  # Rooms
  resources :rooms, param: :id do
    member do
      post :join
      delete :leave
      get "livekit_token", to: "livekit#token", as: :livekit_token
    end
    resources :messages, only: [ :create, :update, :destroy ]
  end

  # Individual direct-message actions (edit / delete)
  resources :direct_messages, only: [ :update, :destroy ]

  # Direct Messages
  resources :users, only: [ :show, :index ] do
    resource :direct_messages, only: [ :show, :create ]
    post "status", to: "users#update_status", on: :collection
  end

  root to: "rooms#index"
end
