# Build context: apps/api
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY global.json Directory.Build.props ./
COPY Zenigma.Api/Zenigma.Api.csproj Zenigma.Api/
RUN dotnet restore Zenigma.Api/Zenigma.Api.csproj
COPY Zenigma.Api/ Zenigma.Api/
RUN dotnet publish Zenigma.Api/Zenigma.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "Zenigma.Api.dll"]
