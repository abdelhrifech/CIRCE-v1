USE [CIRCE]
GO
/****** Object:  User [admin_circe]    Script Date: 03/11/2026 10:34:25 ******/
CREATE USER [admin_circe] FOR LOGIN [admin_circe] WITH DEFAULT_SCHEMA=[dbo]
GO
/****** Object:  User [reader_circe]    Script Date: 03/11/2026 10:34:25 ******/
CREATE USER [reader_circe] FOR LOGIN [reader_circe] WITH DEFAULT_SCHEMA=[dbo]
GO
/****** Object:  User [user_circe]    Script Date: 03/11/2026 10:34:25 ******/
CREATE USER [user_circe] FOR LOGIN [user_circe] WITH DEFAULT_SCHEMA=[dbo]
GO
/****** Object:  User [user_tws]    Script Date: 03/11/2026 10:34:25 ******/
CREATE USER [user_tws] FOR LOGIN [user_tws] WITH DEFAULT_SCHEMA=[dbo]
GO
/****** Object:  DatabaseRole [db_execproc]    Script Date: 03/11/2026 10:34:25 ******/
CREATE ROLE [db_execproc]
GO
/****** Object:  DatabaseRole [gr_swinptf]    Script Date: 03/11/2026 10:34:25 ******/
CREATE ROLE [gr_swinptf]
GO
ALTER ROLE [db_owner] ADD MEMBER [admin_circe]
GO
ALTER ROLE [db_execproc] ADD MEMBER [reader_circe]
GO
ALTER ROLE [db_datareader] ADD MEMBER [reader_circe]
GO
ALTER ROLE [db_execproc] ADD MEMBER [user_circe]
GO
ALTER ROLE [db_datareader] ADD MEMBER [user_circe]
GO
ALTER ROLE [db_datawriter] ADD MEMBER [user_circe]
GO
ALTER ROLE [db_execproc] ADD MEMBER [user_tws]
GO
ALTER ROLE [db_datareader] ADD MEMBER [user_tws]
GO
ALTER ROLE [db_datawriter] ADD MEMBER [user_tws]
GO
/****** Object:  Default [d_t_dat_sys]    Script Date: 03/11/2026 10:34:25 ******/
CREATE DEFAULT [dbo].[d_t_dat_sys] 
AS
getdate()
GO
/****** Object:  Rule [r_t_bool]    Script Date: 03/11/2026 10:34:25 ******/
CREATE RULE [dbo].[r_t_bool] 
AS
@column is null or ( @column in (0,1) )
GO
/****** Object:  Rule [r_t_dat_sys]    Script Date: 03/11/2026 10:34:25 ******/
CREATE RULE [dbo].[r_t_dat_sys] 
AS
@column <= convert (smalldatetime, getdate())
GO
/****** Object:  UserDefinedDataType [dbo].[t_adr]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_adr] FROM [varchar](50) NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_bool]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_bool] FROM [tinyint] NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_cal_colis]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_cal_colis] FROM [smallint] NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_cod_app]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_cod_app] FROM [char](3) NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_cod_lieu]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_cod_lieu] FROM [char](2) NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_cod_ord]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_cod_ord] FROM [char](15) NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_cp]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_cp] FROM [char](5) NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_dat]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_dat] FROM [datetime] NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_dat_sys]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_dat_sys] FROM [smalldatetime] NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_dat_time]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_dat_time] FROM [datetime] NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_description]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_description] FROM [varchar](2000) NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_id_c]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_id_c] FROM [tinyint] NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_id_l]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_id_l] FROM [numeric](9, 0) NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_id_m]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_id_m] FROM [int] NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_id_s]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_id_s] FROM [smallint] NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_ip]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_ip] FROM [char](15) NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_lib_c]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_lib_c] FROM [varchar](50) NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_lib_l]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_lib_l] FROM [varchar](255) NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_lib_m]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_lib_m] FROM [varchar](100) NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_localite]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_localite] FROM [varchar](50) NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_mail]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_mail] FROM [varchar](30) NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_nom]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_nom] FROM [varchar](50) NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_num_c]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_num_c] FROM [tinyint] NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_num_s]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_num_s] FROM [smallint] NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_path_file]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_path_file] FROM [varchar](30) NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_poids_l]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_poids_l] FROM [numeric](6, 3) NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_poids_s]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_poids_s] FROM [numeric](4, 2) NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_qte]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_qte] FROM [int] NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_ref_trans]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_ref_trans] FROM [varchar](50) NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_semaine]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_semaine] FROM [char](7) NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_stat_car]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_stat_car] FROM [char](1) NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_stat_num]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_stat_num] FROM [tinyint] NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_tald_type]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_tald_type] FROM [char](2) NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_tel]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_tel] FROM [char](14) NULL
GO
/****** Object:  UserDefinedDataType [dbo].[t_user]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[t_user] FROM [char](8) NULL
GO
/****** Object:  UserDefinedTableType [dbo].[adresseLivraisonAfficheurTableType]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[adresseLivraisonAfficheurTableType] AS TABLE(
	[IdRessource] [int] NOT NULL,
	[DateDebutPivot] [date] NOT NULL,
	[DateFinPivot] [date] NULL,
	[IdAdresse] [int] NULL,
	[Destinataire] [varchar](101) NULL,
	[PointDeRemise] [varchar](50) NULL,
	[NumeroDeVoie] [varchar](50) NULL,
	[TypeDeVoie] [varchar](50) NULL,
	[LibelleVoie] [varchar](100) NULL,
	[LieuDit] [varchar](250) NULL,
	[CodePostal] [varchar](5) NULL,
	[Commune] [varchar](60) NULL,
	[Cedex] [varchar](50) NULL,
	[IdTypeDestinationDA] [int] NULL,
	[IdTiers] [int] NULL,
	[IdDepot] [int] NULL,
	[IdSiteCCF] [int] NULL,
	[Mail] [varchar](50) NULL,
	[NumTel] [varchar](50) NULL
)
GO
/****** Object:  UserDefinedTableType [dbo].[afficheIntegerTableType]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[afficheIntegerTableType] AS TABLE(
	[afficheId] [int] NULL
)
GO
/****** Object:  UserDefinedTableType [dbo].[groupePreparationTableType]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[groupePreparationTableType] AS TABLE(
	[IdGroupePreparation] [int] NOT NULL,
	[IdReferentielStatut] [int] NOT NULL,
	[IdTypePreparation] [int] NOT NULL,
	[IdFormat] [int] NOT NULL,
	[IdSiteCCF] [int] NOT NULL,
	[Entretien] [int] NOT NULL,
	[Semaine] [int] NOT NULL,
	[AnneeSemaine] [int] NOT NULL,
	[QuiCreation] [varchar](30) NULL,
	[DateCreation] [datetime] NULL,
	[QuiModification] [varchar](30) NULL,
	[DateModification] [datetime] NULL,
	[ReferenceMigration] [varchar](50) NULL
)
GO
/****** Object:  UserDefinedTableType [dbo].[IdGenericList]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[IdGenericList] AS TABLE(
	[Id] [int] NOT NULL
)
GO
/****** Object:  UserDefinedTableType [dbo].[listeUMTableType]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[listeUMTableType] AS TABLE(
	[UM_id] [int] NULL
)
GO
/****** Object:  UserDefinedTableType [dbo].[preparationDetailTableType]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[preparationDetailTableType] AS TABLE(
	[IdPreparationDetail] [int] NOT NULL,
	[IdGroupePreparation] [int] NOT NULL,
	[IdAdresse] [int] NOT NULL,
	[IdTypeDestinationDA] [int] NOT NULL,
	[IdTheme] [int] NULL,
	[IdThemeBandeau] [int] NULL,
	[IdThemeFlap] [int] NULL,
	[Quantite] [int] NOT NULL,
	[QuantiteEntretien] [int] NOT NULL,
	[Destinataire] [varchar](50) NULL,
	[IdRessource] [int] NULL,
	[Afficheur] [varchar](50) NULL,
	[QuiCreation] [varchar](30) NULL,
	[DateCreation] [datetime] NULL,
	[QuiModification] [varchar](30) NULL,
	[DateModification] [datetime] NULL,
	[ReferenceMigration] [varchar](50) NULL
)
GO
/****** Object:  UserDefinedTableType [dbo].[preparationTableType]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[preparationTableType] AS TABLE(
	[IdPreparationChapeau] [int] NULL,
	[IdGroupePreparation] [int] NULL,
	[IdPreparationDetail] [int] NULL,
	[IdDossierDeVenteChapeau] [int] NULL,
	[DatePremierDepart] [datetime] NULL,
	[Annonceur] [varchar](255) NULL,
	[IdTheme] [int] NULL,
	[Theme] [varchar](30) NULL,
	[IdThemeBandeau] [int] NULL,
	[ThemeBandeau] [varchar](30) NULL,
	[IdTypePreparation] [int] NULL,
	[IdFormat] [int] NULL,
	[IdSurface] [int] NULL,
	[IdSiteCCF] [int] NULL,
	[Semaine] [int] NULL,
	[AnneeSemaine] [int] NULL,
	[Quantite] [int] NULL,
	[QuantiteEntretien] [int] NULL,
	[IdRessource] [int] NULL,
	[Nom] [varchar](50) NULL,
	[Prenom] [varchar](50) NULL,
	[IdTypeDestinationDA] [int] NULL,
	[IdDestinataire] [int] NULL,
	[IdAdresse] [int] NULL,
	[IdReferentielStatut] [int] NULL
)
GO
/****** Object:  UserDefinedTableType [dbo].[themeTableType]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[themeTableType] AS TABLE(
	[IdTheme] [int] NOT NULL,
	[IdInstructionChapeau] [int] NOT NULL,
	[IdTypeTheme] [int] NOT NULL,
	[Description] [varchar](30) NULL,
	[Photo] [varchar](255) NULL,
	[QuiCreation] [varchar](30) NULL,
	[DateCreation] [datetime] NULL,
	[QuiModification] [varchar](30) NULL,
	[DateModification] [datetime] NULL,
	[ReferenceMigration] [varchar](50) NULL
)
GO
/****** Object:  UserDefinedTableType [dbo].[trainAfficheTableType]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[trainAfficheTableType] AS TABLE(
	[Id] [int] NOT NULL,
	[IdFaceOTAffichage] [int] NULL,
	[IdFace] [int] NULL,
	[RefFace] [varchar](30) NULL,
	[IdFormat] [int] NULL,
	[IdSurface] [int] NULL,
	[DateDepart] [datetime] NULL,
	[IdLocalisation] [int] NULL,
	[IdStructure] [int] NULL,
	[IdPanel] [int] NULL,
	[IdRessource] [int] NULL,
	[Nom] [varchar](50) NULL,
	[Prenom] [varchar](50) NULL,
	[EstInterne] [bit] NOT NULL,
	[IdUniversContractuel] [int] NULL,
	[IdTypePreparation] [int] NULL,
	[AnneeSemaine] [int] NULL,
	[Semaine] [int] NULL,
	[IdDossierDeVenteChapeau] [int] NULL,
	[IdAnnonceur] [int] NULL,
	[AnnonceurLibelle] [varchar](255) NULL,
	[IdTypeDestinationDA] [int] NULL,
	[IdDestinataire] [int] NULL,
	[IdAdresseDestinataire] [int] NULL,
	[IdAdressePat] [int] NULL,
	[IdTypeVoie] [int] NULL,
	[TypeVoieLibelle] [varchar](50) NULL,
	[IdCommune] [int] NULL,
	[CommuneNom] [varchar](50) NULL,
	[NumeroDeVoie] [varchar](50) NULL,
	[Voie] [varchar](100) NULL,
	[BoitePostale] [varchar](50) NULL,
	[LieuDit] [varchar](250) NULL,
	[CodePostalLibre] [varchar](5) NULL,
	[Localite] [varchar](50) NULL,
	[IdPDVFace] [int] NULL,
	[IdEspace] [int] NULL,
	[EspaceNom] [varchar](50) NULL,
	[NumeroOrdre] [int] NULL,
	[PositionTrainOrigine] [smallint] NULL,
	[PositionTrainModifie] [smallint] NULL,
	[IdSiteCCF] [int] NULL,
	[Traitement] [char](1) NULL,
	[Conservation] [int] NULL,
	[RegionCCF] [varchar](50) NULL,
	[CoteCote] [tinyint] NULL
)
GO
/****** Object:  UserDefinedTableType [dbo].[trainInstructionDetailTableType]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[trainInstructionDetailTableType] AS TABLE(
	[Id] [int] NULL,
	[origine] [varchar](20) NULL,
	[cont_num] [int] NULL,
	[cadr_ident] [int] NULL,
	[cdep_datdep] [datetime] NULL,
	[date_ligne] [datetime] NULL,
	[sect_code] [smallint] NULL,
	[valeur] [varchar](30) NULL,
	[rese_ident] [int] NULL,
	[depa_code] [char](2) NULL,
	[aggl_numord] [int] NULL,
	[afch_ident] [int] NULL,
	[theme] [varchar](50) NULL,
	[sect_code_centre] [int] NULL,
	[form_larg] [smallint] NULL,
	[form_haut] [smallint] NULL,
	[tyaf_code] [int] NULL,
	[talr_trait] [char](1) NULL,
	[type_instruction] [varchar](20) NULL,
	[cont_anbas] [int] NULL,
	[cont_sembas] [int] NULL,
	[cadre_lib] [varchar](30) NULL,
	[IdFaceOTAffichage] [int] NULL,
	[IdTypePreparation] [int] NULL
)
GO
/****** Object:  UserDefinedTableType [dbo].[trainInstructionTableType]    Script Date: 03/11/2026 10:34:25 ******/
CREATE TYPE [dbo].[trainInstructionTableType] AS TABLE(
	[Id] [int] NULL,
	[type_instruction] [varchar](20) NULL,
	[rese_ident] [int] NULL,
	[cont_num] [int] NULL,
	[nom] [varchar](30) NULL,
	[date_ligne] [datetime] NULL,
	[afch_ident] [int] NULL,
	[theme] [varchar](50) NULL,
	[sect_code_centre] [int] NULL,
	[pourcentage] [decimal](6, 2) NULL,
	[form_larg] [smallint] NULL,
	[form_haut] [smallint] NULL,
	[tyaf_code] [int] NULL,
	[typr_code] [int] NULL,
	[cont_anbas] [int] NULL,
	[cont_sembas] [int] NULL,
	[talr_trait] [char](1) NULL,
	[Commentaire] [varchar](255) NULL
)
GO
/****** Object:  UserDefinedFunction [dbo].[Fn_GetPrepaAffiche]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE FUNCTION [dbo].[Fn_GetPrepaAffiche](
     @dateDebut datetime = NULL,
	 @dateFin datetime = NULL,
	 @debut int = NULL,
	 @fin int = NULL,
	 @anneeDebut int = NULL,
	 @anneeFin int = NULL,
	 @plt_id int,
     @isLivraison bit = false
	 )

RETURNS @result TABLE 
(
    [Id] [int] NOT NULL, 
	[LivraisonId] int null,
	[NumeroLivraison] [int] NULL, 
	[DateLivraison] [datetime] NULL,
	[plt_id] [int] NULL,
	[sup_id] [int] NULL,
	[cont_num] [int] NULL,
	[Format] [varchar](50) NULL,
	[Description] [varchar](255) NULL,
	[rpc_annonceur] [varchar](100) NULL,
	[rpc_num_aff_amt] [int] NULL,
	[rpc_theme] [varchar](50) NULL,
	[Statut] [varchar](50) NULL,
	[Qte_Theorique] [int] NULL,
	[sem_num] [int] NULL,
	[sem_annee] [int] NULL,
	[affiche_livraison_Id] [int] NULL,
	[FromBroadcast] [bit] NULL,
	[ARecevoir] [bit] NULL,
	[dateCreated] [datetime] NULL,
	[dateModified] [datetime] NULL,
	[repiquage] [varchar](50) NULL,
	[IdDAChapeau] [int] NULL
)
AS
BEGIN

  DECLARE @maxWeekPerYear int
   SELECT @maxWeekPerYear = DATEPART( wk, DATEADD(yy, DATEDIFF(yy, 0, GETDATE()) + 1, -1))

   IF(@isLivraison = 1)
    BEGIN
	 
	 insert into @result ([Id],
	[LivraisonId],
	[NumeroLivraison], 
	[DateLivraison],
	[plt_id],
	[sup_id],
	[cont_num],
	[Format],
	[Description],
	[rpc_annonceur],
	[rpc_num_aff_amt],
	[rpc_theme],
	[Statut],
	[Qte_Theorique],
	[sem_num] ,
	[sem_annee] ,
	[affiche_livraison_Id],
	[FromBroadcast],
	[ARecevoir],
	[dateCreated],
	[dateModified],
	[repiquage],
	[IdDAChapeau])
	   SELECT
	tfprep.[Id],
	liv.Id,
	liv.Id,
	liv.DateLivraison,
	tfprep.[plt_id],
	tfprep.[sup_id],
	tfprep.[cont_num],
	tfprep.[Format],
	tfprep.[Description],
	tfprep.[rpc_annonceur],
	tfprep.[rpc_num_aff_amt],
	tfprep.[rpc_theme],
	tfprep.[Statut],
	tfprep.[Qte_Theorique],
	tfprep.[sem_num] ,
	tfprep.[sem_annee] ,
	tfprep.[affiche_livraison_Id],
	tfprep.[FromBroadcast],
	tfprep.[ARecevoir],
	tfprep.[dateCreated],
	tfprep.[dateModified],
	tfprep.[repiquage],
	tfprep.[IdDAChapeau]
     FROM 
       livraison liv
     JOIN
       asso_livraison_affiche assoc on liv.Id = assoc.Id_livraison
     JOIN
       tf_prepa_affiche tfprep on assoc.Id_affiche_livraison = tfprep.affiche_livraison_Id
     WHERE
	   DateLivraison >= @dateDebut AND DateLivraison <= @dateFin AND tfprep.plt_id = @plt_id AND tfprep.ARecevoir = 1
	  
	END
   ELSE
    BEGIN
	 IF(@anneeDebut = @anneeFin)
	  BEGIN

	 insert into @result ([Id],
	[plt_id],
	[LivraisonId],
	[NumeroLivraison], 
	[DateLivraison],
	[sup_id],
	[cont_num],
	[Format],
	[Description],
	[rpc_annonceur],
	[rpc_num_aff_amt],
	[rpc_theme],
	[Statut],
	[Qte_Theorique],
	[sem_num] ,
	[sem_annee] ,
	[affiche_livraison_Id],
	[FromBroadcast],
	[ARecevoir],
	[dateCreated],
	[dateModified],
	[repiquage],
	[IdDAChapeau])
	   SELECT
	tfprep.[Id],
	null,
	null,
	null,
	tfprep.[plt_id],
	tfprep.[sup_id],
	tfprep.[cont_num],
	tfprep.[Format],
	tfprep.[Description],
	tfprep.[rpc_annonceur],
	tfprep.[rpc_num_aff_amt],
	tfprep.[rpc_theme],
	tfprep.[Statut],
	tfprep.[Qte_Theorique],
	tfprep.[sem_num] ,
	tfprep.[sem_annee] ,
	tfprep.[affiche_livraison_Id],
	tfprep.[FromBroadcast],
	tfprep.[ARecevoir],
	tfprep.[dateCreated],
	tfprep.[dateModified],
	tfprep.[repiquage],
	tfprep.[IdDAChapeau]
     FROM 
       tf_prepa_affiche tfprep 
     WHERE
	   sem_annee = @anneeDebut AND (sem_num between @debut and @fin) AND tfprep.plt_id = @plt_id AND (tfprep.ARecevoir = 0 OR tfprep.ARecevoir is null )
       AND tfprep.affiche_livraison_Id is null
	 
     UNION

	  SELECT
	tfprep.[Id],
	null,
	null,
	null,
	tfprep.[plt_id],
	tfprep.[sup_id],
	tfprep.[cont_num],
	tfprep.[Format],
	tfprep.[Description],
	tfprep.[rpc_annonceur],
	tfprep.[rpc_num_aff_amt],
	tfprep.[rpc_theme],
	tfprep.[Statut],
	tfprep.[Qte_Theorique],
	tfprep.[sem_num] ,
	tfprep.[sem_annee] ,
	tfprep.[affiche_livraison_Id],
	tfprep.[FromBroadcast],
	tfprep.[ARecevoir],
	tfprep.[dateCreated],
	tfprep.[dateModified],
	tfprep.[repiquage],
	tfprep.[IdDAChapeau]
     FROM 
       tf_prepa_affiche tfprep 
	 JOIN 
	   affiche aff on tfprep.affiche_livraison_Id = aff.affiche_id
	 JOIN
	   mouvement mvt on aff.affiche_id = mvt.affiche_id
	 WHERE
	   tfprep.plt_id = @plt_id 
	   AND
	  	  sem_annee = @anneeDebut AND (sem_num between @debut and @fin) AND tfprep.plt_id = @plt_id AND (tfprep.ARecevoir = 0 OR tfprep.ARecevoir is null )
	 GROUP BY
	   tfprep.[Id],
	   tfprep.[plt_id],
	   tfprep.[sup_id],
	   tfprep.[cont_num],
	   tfprep.[Format],
	   tfprep.[Description],
	   tfprep.[rpc_annonceur],
	   tfprep.[rpc_num_aff_amt],
	   tfprep.[rpc_theme],
	   tfprep.[Statut],
	   tfprep.[Qte_Theorique],
	   tfprep.[sem_num] ,
	   tfprep.[sem_annee] ,
	   tfprep.[affiche_livraison_Id],
	   tfprep.[FromBroadcast],
	   tfprep.[ARecevoir],
	   tfprep.[dateCreated],
	   tfprep.[dateModified],
	   tfprep.[repiquage],
	   tfprep.[IdDAChapeau]
	 HAVING
	   tfprep.Qte_Theorique > SUM(mvt.quantite)


      END
	ELSE
	  BEGIN

	  insert into @result ([Id],
	[LivraisonId],
	[NumeroLivraison], 
	[DateLivraison],
	[plt_id],
	[sup_id],
	[cont_num],
	[Format],
	[Description],
	[rpc_annonceur],
	[rpc_num_aff_amt],
	[rpc_theme],
	[Statut],
	[Qte_Theorique],
	[sem_num] ,
	[sem_annee] ,
	[affiche_livraison_Id],
	[FromBroadcast],
	[ARecevoir],
	[dateCreated],
	[dateModified],
	[repiquage],
	[IdDAChapeau])
	   SELECT
	tfprep.[Id],
	null,
	null,
	null,
	tfprep.[plt_id],
	tfprep.[sup_id],
	tfprep.[cont_num],
	tfprep.[Format],
	tfprep.[Description],
	tfprep.[rpc_annonceur],
	tfprep.[rpc_num_aff_amt],
	tfprep.[rpc_theme],
	tfprep.[Statut],
	tfprep.[Qte_Theorique],
	tfprep.[sem_num] ,
	tfprep.[sem_annee] ,
	tfprep.[affiche_livraison_Id],
	tfprep.[FromBroadcast],
	tfprep.[ARecevoir],
	tfprep.[dateCreated],
	tfprep.[dateModified],
	tfprep.[repiquage],
	tfprep.[IdDAChapeau]
     FROM 
       tf_prepa_affiche tfprep 
     WHERE
	   ((sem_annee = @anneeDebut AND (sem_num between @debut and @maxWeekPerYear)) OR (sem_annee = @anneeFin AND (sem_num between 1 and @fin)))
	    AND tfprep.plt_id = @plt_id AND (tfprep.ARecevoir = 0 OR tfprep.ARecevoir is null ) AND tfprep.affiche_livraison_Id is null

     UNION

	  SELECT
	tfprep.[Id],
	null,
	null,
	null,
	tfprep.[plt_id],
	tfprep.[sup_id],
	tfprep.[cont_num],
	tfprep.[Format],
	tfprep.[Description],
	tfprep.[rpc_annonceur],
	tfprep.[rpc_num_aff_amt],
	tfprep.[rpc_theme],
	tfprep.[Statut],
	tfprep.[Qte_Theorique],
	tfprep.[sem_num] ,
	tfprep.[sem_annee] ,
	tfprep.[affiche_livraison_Id],
	tfprep.[FromBroadcast],
	tfprep.[ARecevoir],
	tfprep.[dateCreated],
	tfprep.[dateModified],
	tfprep.[repiquage],
	tfprep.[IdDAChapeau]
     FROM 
       tf_prepa_affiche tfprep 
	 JOIN 
	   affiche aff on tfprep.affiche_livraison_Id = aff.affiche_id
	 JOIN
	   mouvement mvt on aff.affiche_id = mvt.affiche_id
	 WHERE
	   tfprep.plt_id = @plt_id 
	   AND
	  	  ((sem_annee = @anneeDebut AND (sem_num between @debut and @maxWeekPerYear)) OR (sem_annee = @anneeFin AND (sem_num between 1 and @fin)))
		   AND tfprep.plt_id = @plt_id AND (tfprep.ARecevoir = 0 OR tfprep.ARecevoir is null )

	 GROUP BY
	   tfprep.[Id],
	   tfprep.[plt_id],
	   tfprep.[sup_id],
	   tfprep.[cont_num],
	   tfprep.[Format],
	   tfprep.[Description],
	   tfprep.[rpc_annonceur],
	   tfprep.[rpc_num_aff_amt],
	   tfprep.[rpc_theme],
	   tfprep.[Statut],
	   tfprep.[Qte_Theorique],
	   tfprep.[sem_num] ,
	   tfprep.[sem_annee] ,
	   tfprep.[affiche_livraison_Id],
	   tfprep.[FromBroadcast],
	   tfprep.[ARecevoir],
	   tfprep.[dateCreated],
	   tfprep.[dateModified],
	   tfprep.[repiquage],
	   tfprep.[IdDAChapeau]
	 HAVING
	   tfprep.Qte_Theorique > SUM(mvt.quantite)


	  END
  
	
	END
	  -- select 'test'

  return
END

GO
/****** Object:  Table [dbo].[tr_categorie_support]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_categorie_support](
	[sup_id] [smallint] NOT NULL,
	[sup_nom] [varchar](50) NOT NULL,
	[sup_bandeaux] [tinyint] NOT NULL,
	[sup_poids] [numeric](7, 2) NULL,
	[sup_qte_UM] [int] NULL,
	[reception] [bit] NULL,
 CONSTRAINT [PK_TR_CATEGORIE_SUPPORT] PRIMARY KEY CLUSTERED 
(
	[sup_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  View [dbo].[v_support_scrolling]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
create view [dbo].[v_support_scrolling] as 

select sup_id, sup_nom from tr_categorie_support
where sup_id in (26,1026,1027)

GO
/****** Object:  Table [dbo].[Activite]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Activite](
	[IdActivite] [int] IDENTITY(1,1) NOT NULL,
	[IdEquipe] [int] NOT NULL,
	[IdMachine] [int] NOT NULL,
	[IdAffiche] [int] NOT NULL,
	[Quantite] [int] NOT NULL,
	[Rebus] [int] NULL,
	[DateProduction] [datetime] NULL,
	[QuiCreation] [varchar](20) NULL,
	[DateCreation] [datetime] NULL,
	[id_affiche_initial] [int] NULL,
 CONSTRAINT [PK_Activite] PRIMARY KEY CLUSTERED 
(
	[IdActivite] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[affiche]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[affiche](
	[affiche_id] [int] IDENTITY(1,1) NOT NULL,
	[plt_id] [tinyint] NOT NULL,
	[sup_id] [smallint] NOT NULL,
	[photo_id] [int] NULL,
	[date_entree] [date] NOT NULL,
	[commentaire] [varchar](max) NULL,
	[cont_num] [varchar](50) NULL,
	[cont_annonc] [varchar](50) NULL,
	[theme] [varchar](50) NULL,
	[repiquage] [varchar](50) NULL,
	[conservation] [int] NOT NULL,
	[quantite] [int] NOT NULL,
	[date_dernier_depart] [date] NULL,
	[allee] [varchar](10) NULL,
	[rayon] [varchar](10) NULL,
	[date_derniere_sortie] [datetime] NULL,
	[rebus] [bit] NULL,
	[user_creation] [varchar](20) NULL,
	[user_maj] [varchar](20) NULL,
	[date_creation] [datetime] NULL,
	[date_maj] [datetime] NULL,
	[validationAdmin] [bit] NULL,
	[envoye] [bit] NULL,
	[zone_Picking] [bit] NULL,
	[a_conserver] [bit] NULL,
	[date_rebus] [datetime] NULL,
	[semaines] [varchar](200) NULL,
	[nombre_semaine] [int] NULL,
	[est_fusionne] [bit] NULL,
PRIMARY KEY CLUSTERED 
(
	[affiche_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ARCH_tf_colis]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ARCH_tf_colis](
	[ArchiveID] [bigint] IDENTITY(1,1) NOT NULL,
	[colis_id] [int] NOT NULL,
	[fc_col_id] [int] NULL,
	[colis_code] [varchar](20) NULL,
	[rpc_statut] [tinyint] NULL,
	[dest_id] [int] NULL,
	[ate_id] [smallint] NULL,
	[colis_dat_expe] [datetime] NULL,
	[tsp_id] [int] NULL,
	[tarif_code] [varchar](20) NULL,
	[adr_id] [int] NULL,
	[adr_destinataire] [varchar](50) NULL,
	[adr_num_voie] [varchar](50) NULL,
	[adr_type_voie] [varchar](50) NULL,
	[adr_voie] [varchar](100) NULL,
	[adr_lieu_dit] [varchar](50) NULL,
	[adr_localite] [varchar](50) NULL,
	[adr_code_postal] [varchar](5) NULL,
	[adr_cedex] [varchar](50) NULL,
	[colis_dat_cre] [datetime] NULL,
	[colis_dat_maj] [datetime] NULL,
	[colis_user] [varchar](30) NULL,
	[colis_code_ext] [varchar](50) NULL,
	[colis_poids] [float] NULL,
	[ArchiveDate] [datetime] NULL,
	[commentaire] [varchar](max) NULL,
 CONSTRAINT [PK_ARCH_tf_colis] PRIMARY KEY CLUSTERED 
(
	[ArchiveID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ARCH_tf_face_train]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ARCH_tf_face_train](
	[ArchiveID] [bigint] IDENTITY(1,1) NOT NULL,
	[ft_id] [int] NOT NULL,
	[dest_id] [int] NULL,
	[rpc_statut] [tinyint] NULL,
	[ate_id] [smallint] NULL,
	[sup_id] [smallint] NULL,
	[instr_code] [varchar](18) NOT NULL,
	[cadr_ident] [numeric](9, 0) NOT NULL,
	[cadre_lib] [varchar](20) NULL,
	[rdep_datdep] [smalldatetime] NOT NULL,
	[empl_ident] [numeric](9, 0) NULL,
	[pers_ident] [numeric](9, 0) NULL,
	[pers_nom] [varchar](50) NULL,
	[tyaf_code] [smallint] NULL,
	[reac_code] [tinyint] NULL,
	[typr_code] [tinyint] NULL,
	[cont_sembas] [tinyint] NULL,
	[cont_anbas] [smallint] NULL,
	[cont_num] [int] NULL,
	[cont_annonc] [varchar](30) NULL,
	[empl_sect_code] [smallint] NULL,
	[empl_depa_code] [char](2) NULL,
	[comm_numord] [smallint] NULL,
	[empl_numord] [smallint] NULL,
	[empl_addresse1] [varchar](30) NULL,
	[empl_addresse2] [varchar](30) NULL,
	[empl_addresse3] [varchar](30) NULL,
	[cadr_lettre] [char](1) NULL,
	[form_larg] [smallint] NULL,
	[form_haut] [smallint] NULL,
	[agreement] [varchar](50) NULL,
	[train] [tinyint] NULL,
	[rang] [tinyint] NULL,
	[rese_ident] [numeric](9, 0) NULL,
	[idre_nom] [varchar](50) NULL,
	[panel_ident] [numeric](9, 0) NULL,
	[ft_dat_cre] [datetime] NULL,
	[ft_dat_maj] [datetime] NULL,
	[ft_user_maj] [varchar](20) NULL,
	[theme] [varchar](50) NULL,
	[theme_id] [int] NULL,
	[repiquage] [varchar](50) NULL,
	[repiquage_id] [int] NULL,
	[commune] [varchar](50) NULL,
	[train_id] [varchar](20) NULL,
	[ordre_propose] [tinyint] NULL,
	[ordre_reel] [tinyint] NULL,
	[insv_id] [int] NULL,
	[dep_sembas] [tinyint] NULL,
	[dep_anbas] [smallint] NULL,
	[ft_type] [varchar](15) NULL,
	[version] [tinyint] NULL,
	[rouleur_id] [int] NULL,
	[colis_id] [int] NULL,
	[pre_assemblage] [bit] NULL,
	[ArchiveDate] [datetime] NULL,
	[IdFaceOTAffichage] [int] NULL,
	[CodeUniteUrbaine] [varchar](10) NULL,
	[Conservation] [int] NULL,
	[CoteCote] [tinyint] NULL,
 CONSTRAINT [ARCH_ARCH_tf_face_train] PRIMARY KEY CLUSTERED 
(
	[ArchiveID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ARCH_tf_repart_calcul]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ARCH_tf_repart_calcul](
	[ArchiveID] [bigint] IDENTITY(1,1) NOT NULL,
	[rpc_id] [numeric](9, 0) NOT NULL,
	[sup_id] [smallint] NULL,
	[ate_id] [smallint] NULL,
	[soc_id] [tinyint] NULL,
	[sem_num] [tinyint] NULL,
	[sem_annee] [smallint] NULL,
	[des_id] [numeric](9, 0) NULL,
	[des_type] [tinyint] NULL,
	[des_type_adr] [tinyint] NULL,
	[tpr_id] [smallint] NULL,
	[act_id] [smallint] NULL,
	[rpc_type] [tinyint] NULL,
	[rpc_repartition] [numeric](9, 0) NULL,
	[rpc_annonceur] [varchar](50) NULL,
	[rpc_theme] [varchar](50) NULL,
	[rpc_num_aff_amt] [numeric](9, 0) NULL,
	[rpc_qte] [int] NULL,
	[rpc_dat_aff] [datetime] NULL,
	[rpc_statut] [tinyint] NULL,
	[rpc_refacturation] [tinyint] NULL,
	[rpc_rpfo_ident] [numeric](9, 0) NULL,
	[rpc_user] [varchar](20) NULL,
	[rpc_dat_cre] [smalldatetime] NULL,
	[rpc_dat_maj] [smalldatetime] NULL,
	[rpc_tms] [timestamp] NULL,
	[rpc_san_rep] [char](1) NULL,
	[cont_num] [int] NULL,
	[numeroReception] [varchar](20) NULL,
	[pers_ident] [numeric](9, 0) NULL,
	[pers_nom] [varchar](50) NULL,
	[UM_id] [int] NULL,
	[dest_id] [int] NULL,
	[rpc_retire] [char](1) NULL,
	[ArchiveDate] [datetime] NULL,
	[rpc_repiquage] [varchar](50) NULL,
	[rpc_repiquageId] [int] NULL,
 CONSTRAINT [ARCH_Tf_repart_calcul] PRIMARY KEY CLUSTERED 
(
	[ArchiveID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ARCH_Tf_UM]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ARCH_Tf_UM](
	[ArchiveID] [bigint] IDENTITY(1,1) NOT NULL,
	[UM_id] [int] NOT NULL,
	[tpr_id] [smallint] NULL,
	[ate_id] [smallint] NULL,
	[rpc_statut] [tinyint] NULL,
	[sup_id] [smallint] NULL,
	[dest_id] [int] NULL,
	[sem_num] [tinyint] NULL,
	[sem_annee] [smallint] NULL,
	[UM_repartition] [numeric](9, 0) NULL,
	[UM_annonceur] [varchar](50) NULL,
	[UM_theme] [varchar](50) NULL,
	[UM_num_aff_amt] [numeric](9, 0) NULL,
	[UM_qte] [int] NULL,
	[cont_num] [int] NULL,
	[pers_ident] [numeric](9, 0) NULL,
	[pers_nom] [varchar](50) NULL,
	[UM_poids] [numeric](9, 2) NULL,
	[UM_code_barre] [varchar](18) NULL,
	[UM_code_synthese] [varchar](18) NULL,
	[UM_user] [varchar](20) NULL,
	[UM_dat_cre] [smalldatetime] NULL,
	[UM_dat_maj] [smalldatetime] NULL,
	[UM_comment] [varchar](50) NULL,
	[UM_date_aff] [smalldatetime] NULL,
	[ArchiveDate] [datetime] NULL,
 CONSTRAINT [ARCH_tf_UM] PRIMARY KEY CLUSTERED 
(
	[ArchiveID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ARCH_tf_UM_colis]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ARCH_tf_UM_colis](
	[ArchiveID] [bigint] IDENTITY(1,1) NOT NULL,
	[UM_id] [int] NOT NULL,
	[colis_id] [int] NOT NULL,
	[uc_qte] [int] NULL,
	[uc_user] [varchar](20) NULL,
	[uc_dat_cre] [datetime] NULL,
	[uc_dat_maj] [datetime] NULL,
	[ArchiveDate] [datetime] NULL,
 CONSTRAINT [PK_ARCH_tf_UM_colis] PRIMARY KEY CLUSTERED 
(
	[ArchiveID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[asso_livraison_affiche]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[asso_livraison_affiche](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Id_affiche_livraison] [int] NULL,
	[Id_livraison] [int] NULL,
	[NumeroLivraison] [int] NULL,
	[id_affiche_initial_livraison] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[asso_livraison_photo]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[asso_livraison_photo](
	[asso_livraison_photo_Id] [int] IDENTITY(1,1) NOT NULL,
	[photo_id] [int] NULL,
	[livraison_Id] [int] NULL,
	[intitule] [varchar](250) NULL,
PRIMARY KEY CLUSTERED 
(
	[asso_livraison_photo_Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ColisPreparationExterne]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ColisPreparationExterne](
	[IdColisPreparationExterne] [int] IDENTITY(1,1) NOT NULL,
	[IdPreparationExterne] [int] NOT NULL,
	[NumeroColis] [varchar](100) NULL,
	[LienSuivi] [varchar](max) NULL,
	[DateCreation] [datetime] NOT NULL,
	[QuiCreation] [varchar](200) NOT NULL,
 CONSTRAINT [PK_ColisPreparationExterne] PRIMARY KEY CLUSTERED 
(
	[IdColisPreparationExterne] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Equipe]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Equipe](
	[IdEquipe] [int] IDENTITY(1,1) NOT NULL,
	[plt_Id] [tinyint] NOT NULL,
	[Libelle] [varchar](50) NOT NULL,
	[QuiCreation] [varchar](20) NULL,
	[DateCreation] [datetime] NULL,
	[QuiModification] [varchar](20) NULL,
	[DateModification] [datetime] NULL,
 CONSTRAINT [PK_Equipe] PRIMARY KEY CLUSTERED 
(
	[IdEquipe] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[fusion_affiche]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[fusion_affiche](
	[id_fusion_affiche] [int] IDENTITY(1,1) NOT NULL,
	[id_affiche_chapeau] [int] NOT NULL,
	[id_affiche] [int] NOT NULL,
	[qui_creation] [varchar](max) NULL,
	[date_creation] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[id_fusion_affiche] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[histo_action_applicative]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[histo_action_applicative](
	[IdActionApplicative] [int] IDENTITY(1,1) NOT NULL,
	[Libelle] [varchar](50) NULL,
	[QuiCreation] [varchar](30) NULL,
	[DateCreation] [datetime] NULL,
	[QuiModification] [varchar](30) NULL,
	[DateModification] [datetime] NULL,
 CONSTRAINT [PK_ActionApplicative] PRIMARY KEY CLUSTERED 
(
	[IdActionApplicative] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[histo_historique_entite]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[histo_historique_entite](
	[IdHistoriqueEntite] [int] IDENTITY(1,1) NOT NULL,
	[IdActionApplicative] [int] NULL,
	[IdTypeEntite] [int] NULL,
	[IdEntite] [int] NULL,
	[AncienneValeur] [varchar](max) NULL,
	[NouvelleValeur] [varchar](max) NULL,
	[Complement] [varchar](max) NULL,
	[JsonData] [varchar](max) NULL,
	[QuiAction] [varchar](30) NULL,
	[DateAction] [datetime] NULL,
 CONSTRAINT [PK_HistoriqueEntite] PRIMARY KEY CLUSTERED 
(
	[IdHistoriqueEntite] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[histo_preparation]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[histo_preparation](
	[IdPreparationChapeau] [int] NULL,
	[IdGroupePreparation] [int] NULL,
	[IdPreparationDetail] [int] NULL,
	[IdDossierDeVenteChapeau] [int] NULL,
	[DatePremierDepart] [datetime] NULL,
	[Annonceur] [varchar](255) NULL,
	[IdTheme] [int] NULL,
	[Theme] [varchar](30) NULL,
	[IdThemeBandeau] [int] NULL,
	[ThemeBandeau] [varchar](30) NULL,
	[IdTypePreparation] [int] NULL,
	[IdFormat] [int] NULL,
	[IdSurface] [int] NULL,
	[IdSiteCCF] [int] NULL,
	[Semaine] [int] NULL,
	[AnneeSemaine] [int] NULL,
	[Quantite] [int] NULL,
	[QuantiteEntretien] [int] NULL,
	[IdRessource] [int] NULL,
	[Nom] [varchar](50) NULL,
	[Prenom] [varchar](50) NULL,
	[IdTypeDestinationDA] [int] NULL,
	[IdDestinataire] [int] NULL,
	[IdAdresse] [int] NULL,
	[rpc_statut] [int] NULL,
	[quiCreation] [varchar](20) NULL,
	[dateCreation] [datetime] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[histo_trainAffiche]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[histo_trainAffiche](
	[Id] [int] NULL,
	[IdFaceOTAffichage] [int] NULL,
	[IdFace] [int] NULL,
	[RefFace] [varchar](30) NULL,
	[IdFormat] [int] NULL,
	[IdSurface] [int] NULL,
	[DateDepart] [datetime] NULL,
	[IdLocalisation] [int] NULL,
	[IdStructure] [int] NULL,
	[IdPanel] [int] NULL,
	[IdRessource] [int] NULL,
	[Nom] [varchar](50) NULL,
	[Prenom] [varchar](50) NULL,
	[EstInterne] [bit] NOT NULL,
	[IdUniversContractuel] [int] NULL,
	[IdTypePreparation] [int] NULL,
	[AnneeSemaine] [int] NULL,
	[Semaine] [int] NULL,
	[IdDossierDeVenteChapeau] [int] NULL,
	[IdAnnonceur] [int] NULL,
	[AnnonceurLibelle] [varchar](255) NULL,
	[IdTypeDestinationDA] [int] NULL,
	[IdDestinataire] [int] NULL,
	[IdAdresseDestinataire] [int] NULL,
	[IdAdressePat] [int] NULL,
	[IdTypeVoie] [int] NULL,
	[TypeVoieLibelle] [varchar](50) NULL,
	[IdCommune] [int] NULL,
	[CommuneNom] [varchar](50) NULL,
	[NumeroDeVoie] [varchar](50) NULL,
	[Voie] [varchar](100) NULL,
	[BoitePostale] [varchar](50) NULL,
	[LieuDit] [varchar](250) NULL,
	[CodePostalLibre] [varchar](5) NULL,
	[Localite] [varchar](50) NULL,
	[IdPDVFace] [int] NULL,
	[IdEspace] [int] NULL,
	[EspaceNom] [varchar](50) NULL,
	[NumeroOrdre] [int] NULL,
	[PositionTrainOrigine] [smallint] NULL,
	[PositionTrainModifie] [smallint] NULL,
	[IdSiteCCF] [int] NULL,
	[Traitement] [char](1) NULL,
	[DateTraitement] [datetime] NULL,
	[IdJourDepart] [int] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[instruction_detail]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[instruction_detail](
	[insd_id] [int] IDENTITY(1,1) NOT NULL,
	[instr_code] [varchar](18) NOT NULL,
	[insd_cadr_ident] [int] NULL,
	[insd_cadre_lib] [varchar](30) NULL,
	[sup_id] [smallint] NULL,
	[tpr_id] [smallint] NULL,
	[insd_afch_ident] [int] NULL,
	[insd_theme] [varchar](50) NULL,
	[insd_repiquage_ident] [int] NULL,
	[insd_repiquage] [varchar](50) NULL,
	[insd_type] [varchar](20) NULL,
	[insd_dat_cre] [datetime] NULL,
	[ins_dat_maj] [datetime] NULL,
	[insd_user] [varchar](20) NULL,
 CONSTRAINT [PK_INSTRUCTION_DETAIL] PRIMARY KEY CLUSTERED 
(
	[insd_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[instruction_train]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[instruction_train](
	[instr_code] [varchar](18) NOT NULL,
	[ate_id] [smallint] NULL,
	[tsr_repart_code] [tinyint] NULL,
	[rpc_statut] [tinyint] NULL,
	[tip_ins_code] [tinyint] NULL,
	[instr_type_instruction] [varchar](20) NULL,
	[rese_ident] [int] NULL,
	[cont_num] [int] NULL,
	[instr_annonceur] [varchar](30) NULL,
	[cont_anbas] [smallint] NULL,
	[cont_sembas] [smallint] NULL,
	[instr_commentaire] [varchar](100) NULL,
	[instr_dat_cre] [datetime] NULL,
	[instr_dat_maj] [datetime] NULL,
	[instr_user] [varchar](20) NULL,
	[instr_entretien] [smallint] NULL,
	[instr_CommentExtPlay] [varchar](255) NULL,
	[Conservation] [int] NULL,
	[CoteCote] [tinyint] NULL,
 CONSTRAINT [PK_INSTRUCTION_TRAIN] PRIMARY KEY CLUSTERED 
(
	[instr_code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[instruction_visuels]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[instruction_visuels](
	[insv_id] [int] IDENTITY(1,1) NOT NULL,
	[instr_code] [varchar](18) NULL,
	[sup_id] [smallint] NULL,
	[tpr_id] [smallint] NULL,
	[rpc_statut] [tinyint] NULL,
	[insv_afch_ident] [int] NULL,
	[insv_theme] [varchar](50) NULL,
	[insv_theme_ori] [varchar](50) NULL,
	[insv_pourcentage_ori] [decimal](6, 2) NULL,
	[insv_dat_cre] [datetime] NULL,
	[insv_dat_maj] [datetime] NULL,
	[insv_user] [varchar](20) NULL,
	[insv_pourcentage] [decimal](6, 2) NULL,
 CONSTRAINT [PK_INSTRUCTION_VISUELS] PRIMARY KEY CLUSTERED 
(
	[insv_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[livraison]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[livraison](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DateLivraison] [datetime] NULL,
	[Expediteur] [varchar](50) NULL,
	[Imprimeur] [varchar](50) NULL,
	[Commentaire] [varchar](255) NULL,
	[Reference] [varchar](50) NULL,
	[Nbre_colis] [int] NULL,
	[Ref_dossier] [varchar](20) NULL,
	[Ref_DA] [varchar](20) NULL,
	[Decharge_par] [varchar](50) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[log_colis_transporteur]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[log_colis_transporteur](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[refUniExp] [bigint] NOT NULL,
	[refUniEnl] [bigint] NULL,
	[codeSa] [varchar](100) NULL,
	[codeClient] [varchar](100) NULL,
	[codeProduit] [varchar](100) NULL,
	[codeOption] [varchar](100) NULL,
	[typePrestation] [varchar](100) NULL,
	[libellePrestation] [varchar](100) NULL,
	[noSuivi] [varchar](100) NULL,
	[noRecepisse] [varchar](100) NULL,
	[reference1] [varchar](100) NULL,
	[reference2] [varchar](100) NULL,
	[dateDepart] [datetime] NULL,
	[dateDepartFrs] [varchar](100) NULL,
	[nomExp] [varchar](1000) NULL,
	[adresse1Exp] [varchar](1000) NULL,
	[adresse2Exp] [varchar](1000) NULL,
	[codePostalExp] [varchar](100) NULL,
	[villeExp] [varchar](100) NULL,
	[codePaysExp] [varchar](100) NULL,
	[libellePaysExp] [varchar](100) NULL,
	[dateLivraison] [datetime] NULL,
	[dateLivraisonFrs] [varchar](100) NULL,
	[libelleLivraison] [varchar](100) NULL,
	[nomDest] [varchar](1000) NULL,
	[adresse1Dest] [varchar](1000) NULL,
	[adresse2Dest] [varchar](1000) NULL,
	[codePostalDest] [varchar](100) NULL,
	[villeDest] [varchar](100) NULL,
	[codePaysDest] [varchar](100) NULL,
	[libellePaysDest] [varchar](100) NULL,
	[refDest] [varchar](100) NULL,
	[poids] [float] NULL,
	[nbColis] [int] NULL,
	[nbPalettes] [int] NULL,
	[codeSituation] [varchar](100) NULL,
	[codeJustification] [varchar](100) NULL,
	[libelleEtat] [varchar](100) NULL,
	[libelleLongEtat] [varchar](1000) NULL,
	[dateEtat] [datetime] NULL,
	[dateEtatFrs] [varchar](100) NULL,
	[avecInstructionDonnee] [bit] NULL,
	[avecAttenteInstruction] [bit] NULL,
	[dateLimiteInstruction] [datetime] NULL,
	[dateLimiteInstructionFrs] [varchar](100) NULL,
	[delaiInstruction] [int] NULL,
	[uniteInstruction] [varchar](100) NULL,
	[avecMatiereDangereuse] [bit] NULL,
	[nbErreursNotification] [int] NULL,
	[urlImageEnlevementLivraison] [varchar](1000) NULL,
	[statutServicesLivraison] [varchar](100) NULL,
	[libelleStatutServicesLivraison] [varchar](1000) NULL,
	[urlPreuveService] [varchar](1000) NULL,
	[emissionEqc] [float] NULL,
	[emissionEqa] [float] NULL,
	[emissionPar] [float] NULL,
	[temperatureMin] [float] NULL,
	[temperatureMax] [float] NULL,
	[temperatureMed] [float] NULL,
	[nbExcursionsTemp] [int] NULL,
	[envoiRegroupe] [bit] NULL,
	[refUniRegroupement] [bigint] NULL,
	[noRecepRegroupement] [varchar](100) NULL,
	[envoiRegroupement] [bit] NULL,
	[dateInsertion] [datetime] NOT NULL,
	[dateIntegration] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Machine]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Machine](
	[IdMachine] [int] IDENTITY(1,1) NOT NULL,
	[plt_Id] [tinyint] NOT NULL,
	[Libelle] [varchar](50) NOT NULL,
	[QuiCreation] [varchar](20) NULL,
	[DateCreation] [datetime] NULL,
	[QuiModification] [varchar](20) NULL,
	[DateModification] [datetime] NULL,
 CONSTRAINT [PK_Machine] PRIMARY KEY CLUSTERED 
(
	[IdMachine] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[mouvement]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[mouvement](
	[mouvement_id] [int] IDENTITY(1,1) NOT NULL,
	[affiche_id] [int] NOT NULL,
	[date] [date] NOT NULL,
	[quantite] [int] NOT NULL,
	[recepisse] [varchar](50) NULL,
	[expediteur] [varchar](50) NULL,
	[user_creation] [varchar](20) NULL,
	[date_creation] [datetime] NULL,
	[comptee] [bit] NULL,
	[livraison_id] [int] NULL,
	[IdActivite] [int] NULL,
	[id_affiche_initial] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[mouvement_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Parametre_Package]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Parametre_Package](
	[Nom_Package] [nvarchar](50) NULL,
	[DateMaj] [datetime] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[photo]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[photo](
	[photo_id] [int] IDENTITY(1,1) NOT NULL,
	[image_mime_type] [varchar](100) NULL,
	[image_file] [varbinary](max) NULL,
	[user_creation] [varchar](20) NULL,
	[user_maj] [varchar](20) NULL,
	[date_creation] [datetime] NULL,
	[date_maj] [datetime] NULL,
	[intitule] [varchar](250) NULL,
	[size] [bigint] NULL,
	[extension] [varchar](50) NULL,
PRIMARY KEY CLUSTERED 
(
	[photo_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PreparationExterne]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PreparationExterne](
	[IdPreparationExterne] [int] IDENTITY(1,1) NOT NULL,
	[NumeroDossier] [int] NOT NULL,
	[Annonceur] [varchar](200) NOT NULL,
	[Theme] [varchar](200) NULL,
	[Flap] [varchar](200) NULL,
	[Bandeau] [varchar](200) NULL,
	[FormatTypePanel] [varchar](200) NOT NULL,
	[Annee] [int] NOT NULL,
	[Semaine] [int] NOT NULL,
	[DateStatut] [datetime] NULL,
	[Quantite] [int] NULL,
	[QuantiteEnvoyee] [int] NULL,
	[LibelleStatutPreparation] [varchar](50) NULL,
	[Commentaire] [varchar](200) NULL,
	[Expediteur] [varchar](50) NOT NULL,
	[DateCreation] [datetime] NOT NULL,
	[QuiCreation] [varchar](200) NOT NULL,
 CONSTRAINT [PK_PreparationExterne] PRIMARY KEY CLUSTERED 
(
	[IdPreparationExterne] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RessourcePreparationExterne]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RessourcePreparationExterne](
	[IdRessourcePreparationExterne] [int] IDENTITY(1,1) NOT NULL,
	[IdPreparationExterne] [int] NOT NULL,
	[IdRessource] [int] NULL,
	[NomRessource] [varchar](100) NULL,
	[DateCreation] [datetime] NOT NULL,
	[QuiCreation] [varchar](200) NOT NULL,
 CONSTRAINT [PK_RessourcePreparationExterne] PRIMARY KEY CLUSTERED 
(
	[IdRessourcePreparationExterne] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Surface]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Surface](
	[IdSurface] [int] NOT NULL,
	[Libelle] [varchar](50) NOT NULL,
	[Valeur] [int] NOT NULL,
	[QuiCreation] [varchar](20) NULL,
	[DateCreation] [datetime] NULL,
	[QuiModification] [varchar](20) NULL,
	[DateModification] [datetime] NULL,
	[ReferenceMigration] [varchar](50) NULL,
 CONSTRAINT [PK_Surface] PRIMARY KEY CLUSTERED 
(
	[IdSurface] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tf_anomalies]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tf_anomalies](
	[rpc_id] [numeric](9, 0) NOT NULL,
	[tan_id] [numeric](9, 0) NOT NULL,
	[ano_valeur] [numeric](9, 0) NOT NULL,
	[ano_user] [char](8) NOT NULL,
	[ano_dat_cre] [smalldatetime] NOT NULL,
	[ano_dat_maj] [dbo].[t_dat_sys] NOT NULL,
	[ano_tms] [timestamp] NOT NULL,
 CONSTRAINT [PK_TF_ANOMALIES] PRIMARY KEY CLUSTERED 
(
	[rpc_id] ASC,
	[tan_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tf_colis]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tf_colis](
	[colis_id] [int] IDENTITY(1,1) NOT NULL,
	[fc_col_id] [int] NULL,
	[colis_code] [varchar](20) NULL,
	[rpc_statut] [tinyint] NULL,
	[dest_id] [int] NULL,
	[ate_id] [smallint] NULL,
	[colis_dat_expe] [datetime] NULL,
	[tsp_id] [int] NULL,
	[tarif_code] [varchar](20) NULL,
	[adr_id] [int] NULL,
	[adr_destinataire] [varchar](50) NULL,
	[adr_num_voie] [varchar](50) NULL,
	[adr_type_voie] [varchar](50) NULL,
	[adr_voie] [varchar](100) NULL,
	[adr_lieu_dit] [varchar](50) NULL,
	[adr_localite] [varchar](50) NULL,
	[adr_code_postal] [varchar](5) NULL,
	[adr_cedex] [varchar](50) NULL,
	[colis_dat_cre] [datetime] NULL,
	[colis_dat_maj] [datetime] NULL,
	[colis_user] [varchar](30) NULL,
	[colis_code_ext] [varchar](50) NULL,
	[colis_poids] [float] NULL,
	[commentaire] [varchar](max) NULL,
	[ref_uni_exp] [bigint] NULL,
	[ref_uni_enl] [bigint] NULL,
	[code_client] [varchar](50) NULL,
	[no_recepisse] [varchar](50) NULL,
	[date_depart] [datetime] NULL,
	[adresse_1_exp] [varchar](50) NULL,
	[adresse_2_exp] [varchar](50) NULL,
	[code_postal_exp] [varchar](50) NULL,
	[ville_exp] [varchar](50) NULL,
	[date_livraison] [datetime] NULL,
	[libelle_livraison] [varchar](50) NULL,
	[nom_dest] [varchar](50) NULL,
	[adresse_1_dest] [varchar](50) NULL,
	[adresse_2_dest] [varchar](50) NULL,
	[code_postal_dest] [varchar](50) NULL,
	[ville_dest] [varchar](50) NULL,
	[date_etat] [datetime] NULL,
	[libelle_etat] [varchar](50) NULL,
	[url_image_livraison] [varchar](max) NULL,
	[url_preuve_livraison] [varchar](max) NULL,
	[Mailcolis_envoye] [bit] NULL,
 CONSTRAINT [PK_TF_COLIS] PRIMARY KEY CLUSTERED 
(
	[colis_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tf_colis_ext]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tf_colis_ext](
	[refUniExp] [bigint] NOT NULL,
	[refUniEnl] [bigint] NULL,
	[codeClient] [varchar](50) NULL,
	[noRecepisse] [varchar](50) NULL,
	[reference1] [varchar](100) NULL,
	[dateDepart] [datetime] NULL,
	[adresse1Exp] [varchar](50) NULL,
	[adresse2Exp] [varchar](50) NULL,
	[codePostalExp] [varchar](50) NULL,
	[villeExp] [varchar](50) NULL,
	[dateLivraison] [datetime] NULL,
	[libelleLivraison] [varchar](50) NULL,
	[nomDest] [varchar](50) NULL,
	[adresse1Dest] [varchar](50) NULL,
	[adresse2Dest] [varchar](50) NULL,
	[codePostalDest] [varchar](50) NULL,
	[villeDest] [varchar](50) NULL,
	[dateEtat] [datetime] NULL,
	[libelleEtat] [varchar](50) NULL,
	[urlImageLivraison] [varchar](max) NULL,
	[urlPreuveLivraison] [varchar](max) NULL,
	[estConnu] [bit] NULL,
	[dateIntegration] [datetime] NULL,
 CONSTRAINT [PK_tf_colis_ext] PRIMARY KEY CLUSTERED 
(
	[refUniExp] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tf_dossier_semaine_depart]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tf_dossier_semaine_depart](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[IdAffiche] [int] NOT NULL,
	[Dossier] [int] NULL,
	[Semaine] [int] NULL,
	[Annee] [int] NULL,
 CONSTRAINT [PK_dossier_semaine_depart] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tf_face_train]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tf_face_train](
	[ft_id] [int] IDENTITY(1,1) NOT NULL,
	[dest_id] [int] NULL,
	[rpc_statut] [tinyint] NULL,
	[ate_id] [smallint] NULL,
	[sup_id] [smallint] NULL,
	[instr_code] [varchar](18) NOT NULL,
	[cadr_ident] [numeric](9, 0) NOT NULL,
	[cadre_lib] [varchar](30) NULL,
	[rdep_datdep] [smalldatetime] NOT NULL,
	[empl_ident] [numeric](9, 0) NULL,
	[pers_ident] [numeric](9, 0) NULL,
	[pers_nom] [varchar](50) NULL,
	[tyaf_code] [smallint] NULL,
	[reac_code] [tinyint] NULL,
	[typr_code] [tinyint] NULL,
	[cont_sembas] [tinyint] NULL,
	[cont_anbas] [smallint] NULL,
	[cont_num] [int] NULL,
	[cont_annonc] [varchar](30) NULL,
	[empl_sect_code] [smallint] NULL,
	[empl_depa_code] [char](2) NULL,
	[comm_numord] [smallint] NULL,
	[empl_numord] [smallint] NULL,
	[empl_addresse1] [varchar](30) NULL,
	[empl_addresse2] [varchar](30) NULL,
	[empl_addresse3] [varchar](30) NULL,
	[cadr_lettre] [char](1) NULL,
	[form_larg] [smallint] NULL,
	[form_haut] [smallint] NULL,
	[agreement] [varchar](50) NULL,
	[train] [tinyint] NULL,
	[rang] [tinyint] NULL,
	[rese_ident] [numeric](9, 0) NULL,
	[idre_nom] [varchar](50) NULL,
	[panel_ident] [numeric](9, 0) NULL,
	[ft_dat_cre] [datetime] NULL,
	[ft_dat_maj] [datetime] NULL,
	[ft_user_maj] [varchar](20) NULL,
	[theme] [varchar](50) NULL,
	[theme_id] [int] NULL,
	[repiquage] [varchar](50) NULL,
	[repiquage_id] [int] NULL,
	[commune] [varchar](50) NULL,
	[train_id] [varchar](20) NULL,
	[ordre_propose] [tinyint] NULL,
	[ordre_reel] [tinyint] NULL,
	[insv_id] [int] NULL,
	[dep_sembas] [tinyint] NULL,
	[dep_anbas] [smallint] NULL,
	[ft_type] [varchar](15) NULL,
	[version] [tinyint] NULL,
	[rouleur_id] [int] NULL,
	[colis_id] [int] NULL,
	[pre_assemblage] [bit] NULL,
	[IdFaceOTAffichage] [int] NULL,
	[CodeUniteUrbaine] [varchar](10) NULL,
	[Conservation] [int] NULL,
	[CoteCote] [tinyint] NULL,
	[Convention] [varchar](50) NULL,
	[RefConvention] [varchar](50) NULL,
	[IdTypeDossier] [int] NULL,
	[IdStructure] [int] NULL,
	[ordre_calcule] [int] NULL,
	[ordre_reel_initial] [int] NULL,
	[IdLienCoteCote] [int] NULL,
	[IdPanelDestination] [int] NULL,
	[RefPanel] [varchar](50) NULL,
	[IdProduit] [int] NULL,
	[IdJourDepart] [int] NULL,
 CONSTRAINT [PK_TF_FACE_TRAIN] PRIMARY KEY CLUSTERED 
(
	[ft_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tf_prepa_affiche]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tf_prepa_affiche](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[plt_id] [int] NULL,
	[sup_id] [int] NULL,
	[cont_num] [int] NULL,
	[Format] [varchar](50) NULL,
	[Description] [varchar](255) NULL,
	[rpc_annonceur] [varchar](100) NULL,
	[rpc_num_aff_amt] [int] NULL,
	[rpc_theme] [varchar](50) NULL,
	[Statut] [varchar](50) NULL,
	[Qte_Theorique] [int] NULL,
	[sem_num] [int] NULL,
	[sem_annee] [int] NULL,
	[affiche_livraison_Id] [int] NULL,
	[FromBroadcast] [bit] NULL,
	[ARecevoir] [bit] NULL,
	[dateCreated] [datetime] NULL,
	[dateModified] [datetime] NULL,
	[repiquage] [varchar](50) NULL,
	[IdDAChapeau] [int] NULL,
	[ate_id] [smallint] NULL,
	[affiche_livraison_initial_Id] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tf_prepa_Broadcast]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tf_prepa_Broadcast](
	[id] [numeric](9, 0) IDENTITY(1,1) NOT NULL,
	[DestinataireEffectif] [varchar](50) NULL,
	[IdDossierDeVenteChapeau] [int] NULL,
	[IdDAChapeau] [int] NULL,
	[Annonceur] [varchar](100) NULL,
	[Surface] [varchar](50) NULL,
	[Format] [varchar](50) NULL,
	[AssistantCommercial] [varchar](50) NULL,
	[AssistantLogistique] [varchar](50) NULL,
	[Theme] [varchar](100) NULL,
	[Bandeau] [varchar](50) NULL,
	[quantite] [int] NULL,
	[StatutPreparation] [varchar](50) NULL,
	[dateCreated] [datetime] NULL,
	[dateModified] [datetime] NULL,
	[sem_num] [int] NULL,
	[sem_annee] [int] NULL,
	[sup_id] [int] NULL,
	[repiquage] [varchar](50) NULL,
	[IdThemeBandeau] [int] NULL,
 CONSTRAINT [tf_prepa_BC] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tf_repart_calcul]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tf_repart_calcul](
	[rpc_id] [numeric](9, 0) IDENTITY(1,1) NOT NULL,
	[sup_id] [smallint] NULL,
	[ate_id] [smallint] NULL,
	[soc_id] [tinyint] NULL,
	[sem_num] [tinyint] NULL,
	[sem_annee] [smallint] NULL,
	[des_id] [numeric](9, 0) NULL,
	[des_type] [tinyint] NULL,
	[des_type_adr] [tinyint] NULL,
	[tpr_id] [smallint] NULL,
	[act_id] [smallint] NULL,
	[rpc_type] [tinyint] NULL,
	[rpc_repartition] [numeric](9, 0) NULL,
	[rpc_annonceur] [varchar](50) NULL,
	[rpc_theme] [varchar](50) NULL,
	[rpc_repiquage] [varchar](50) NULL,
	[rpc_repiquageId] [int] NULL,
	[rpc_num_aff_amt] [numeric](9, 0) NULL,
	[rpc_qte] [int] NULL,
	[rpc_dat_aff] [datetime] NULL,
	[rpc_statut] [tinyint] NULL,
	[rpc_refacturation] [tinyint] NULL,
	[rpc_rpfo_ident] [numeric](9, 0) NULL,
	[rpc_user] [varchar](30) NULL,
	[rpc_dat_cre] [smalldatetime] NULL,
	[rpc_dat_maj] [smalldatetime] NULL,
	[rpc_tms] [timestamp] NULL,
	[rpc_san_rep] [char](1) NULL,
	[cont_num] [int] NULL,
	[numeroReception] [varchar](20) NULL,
	[pers_ident] [numeric](9, 0) NULL,
	[pers_nom] [varchar](50) NULL,
	[UM_id] [int] NULL,
	[dest_id] [int] NULL,
	[rpc_retire] [char](1) NULL,
	[IdPreparationDetail] [int] NULL,
 CONSTRAINT [PK_TF_REPART_CALCUL] PRIMARY KEY CLUSTERED 
(
	[rpc_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tf_repart_calcul_svg]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tf_repart_calcul_svg](
	[rpc_id] [numeric](9, 0) IDENTITY(1,1) NOT NULL,
	[sup_id] [smallint] NULL,
	[ate_id] [smallint] NULL,
	[soc_id] [tinyint] NULL,
	[sem_num] [tinyint] NULL,
	[sem_annee] [smallint] NULL,
	[des_id] [numeric](9, 0) NULL,
	[des_type] [tinyint] NULL,
	[des_type_adr] [tinyint] NULL,
	[tpr_id] [smallint] NULL,
	[act_id] [smallint] NULL,
	[rpc_type] [tinyint] NULL,
	[rpc_repartition] [numeric](9, 0) NULL,
	[rpc_annonceur] [varchar](50) NULL,
	[rpc_theme] [varchar](50) NULL,
	[rpc_num_aff_amt] [numeric](9, 0) NULL,
	[rpc_qte] [int] NULL,
	[rpc_dat_aff] [datetime] NULL,
	[rpc_statut] [tinyint] NULL,
	[rpc_refacturation] [tinyint] NULL,
	[rpc_rpfo_ident] [numeric](9, 0) NULL,
	[rpc_user] [varchar](20) NULL,
	[rpc_dat_cre] [smalldatetime] NULL,
	[rpc_dat_maj] [smalldatetime] NULL,
	[rpc_tms] [timestamp] NULL,
	[rpc_san_rep] [char](1) NULL,
	[cont_num] [int] NULL,
	[numeroReception] [varchar](20) NULL,
	[pers_ident] [numeric](9, 0) NULL,
	[pers_nom] [varchar](50) NULL,
	[UM_id] [int] NULL,
	[dest_id] [int] NULL,
	[rpc_retire] [char](1) NULL,
	[IdPreparationDetail] [int] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tf_train_export]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tf_train_export](
	[t_id] [int] IDENTITY(1,1) NOT NULL,
	[dest_id] [int] NULL,
	[rpc_statut] [tinyint] NULL,
	[ate_id] [smallint] NULL,
	[sup_id] [smallint] NULL,
	[instr_code] [varchar](18) NULL,
	[train_id] [varchar](20) NOT NULL,
	[format] [char](1) NULL,
	[statut] [char](1) NULL,
	[origine] [varchar](5) NULL,
	[afficheur] [varchar](30) NULL,
	[zone] [char](1) NULL,
	[section] [varchar](30) NULL,
	[adresse1] [varchar](30) NULL,
	[adresse2] [varchar](30) NULL,
	[centre_commercial] [varchar](30) NULL,
	[type] [varchar](30) NULL,
	[contrat1] [varchar](30) NULL,
	[reseau1] [varchar](30) NULL,
	[annonceur1] [varchar](30) NULL,
	[theme1] [varchar](30) NULL,
	[repiquage1] [varchar](30) NULL,
	[ft_id1] [int] NULL,
	[contrat2] [varchar](30) NULL,
	[reseau2] [varchar](30) NULL,
	[annonceur2] [varchar](30) NULL,
	[theme2] [varchar](30) NULL,
	[repiquage2] [varchar](30) NULL,
	[ft_id2] [int] NULL,
	[contrat3] [varchar](30) NULL,
	[reseau3] [varchar](30) NULL,
	[annonceur3] [varchar](30) NULL,
	[theme3] [varchar](30) NULL,
	[repiquage3] [varchar](30) NULL,
	[ft_id3] [int] NULL,
	[contrat4] [varchar](30) NULL,
	[reseau4] [varchar](30) NULL,
	[annonceur4] [varchar](30) NULL,
	[theme4] [varchar](30) NULL,
	[repiquage4] [varchar](30) NULL,
	[ft_id4] [int] NULL,
	[contrat5] [varchar](30) NULL,
	[reseau5] [varchar](30) NULL,
	[annonceur5] [varchar](30) NULL,
	[theme5] [varchar](30) NULL,
	[repiquage5] [varchar](30) NULL,
	[ft_id5] [int] NULL,
	[contrat6] [varchar](30) NULL,
	[reseau6] [varchar](30) NULL,
	[annonceur6] [varchar](30) NULL,
	[theme6] [varchar](30) NULL,
	[repiquage6] [varchar](30) NULL,
	[ft_id6] [int] NULL,
	[t_dat_cre] [datetime] NULL,
	[t_dat_maj] [datetime] NULL,
	[t_user_maj] [varchar](20) NULL,
	[id_export] [varchar](40) NULL,
 CONSTRAINT [PK_TF_TRAIN_EXPORT] PRIMARY KEY CLUSTERED 
(
	[t_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tf_UM]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tf_UM](
	[UM_id] [int] IDENTITY(1,1) NOT NULL,
	[tpr_id] [smallint] NULL,
	[ate_id] [smallint] NULL,
	[rpc_statut] [tinyint] NULL,
	[sup_id] [smallint] NULL,
	[dest_id] [int] NULL,
	[sem_num] [tinyint] NULL,
	[sem_annee] [smallint] NULL,
	[UM_repartition] [numeric](9, 0) NULL,
	[UM_annonceur] [varchar](50) NULL,
	[UM_theme] [varchar](50) NULL,
	[UM_Repiquage] [varchar](50) NULL,
	[UM_num_aff_amt] [numeric](9, 0) NULL,
	[UM_qte] [int] NULL,
	[cont_num] [int] NULL,
	[pers_ident] [numeric](9, 0) NULL,
	[pers_nom] [varchar](50) NULL,
	[UM_poids] [numeric](9, 2) NULL,
	[UM_code_barre] [varchar](18) NULL,
	[UM_code_synthese] [varchar](18) NULL,
	[UM_user] [varchar](30) NULL,
	[UM_dat_cre] [smalldatetime] NULL,
	[UM_dat_maj] [smalldatetime] NULL,
	[UM_comment] [varchar](50) NULL,
	[UM_date_aff] [smalldatetime] NULL,
 CONSTRAINT [PK_TF_UM] PRIMARY KEY CLUSTERED 
(
	[UM_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tf_UM_colis]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tf_UM_colis](
	[UM_id] [int] NOT NULL,
	[colis_id] [int] NOT NULL,
	[uc_qte] [int] NULL,
	[uc_user] [varchar](20) NULL,
	[uc_dat_cre] [datetime] NULL,
	[uc_dat_maj] [datetime] NULL,
 CONSTRAINT [PK_TF_UM_COLIS] PRIMARY KEY CLUSTERED 
(
	[UM_id] ASC,
	[colis_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[th_amt_log_destination]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[th_amt_log_destination](
	[tald_type] [char](2) NOT NULL,
	[tald_soci_code] [tinyint] NOT NULL,
	[tald_code] [numeric](9, 0) NOT NULL,
	[dat_trait] [datetime] NOT NULL,
	[dest_nom] [varchar](50) NOT NULL,
	[dest_numvoie] [smallint] NULL,
	[dest_voie] [varchar](50) NULL,
	[dest_voiesuite] [varchar](50) NULL,
	[dest_codpost] [char](5) NULL,
	[dest_commune] [varchar](50) NULL,
	[dest_burdistrib] [varchar](50) NULL,
	[dest_tel] [varchar](15) NULL,
	[dest_fax] [varchar](15) NULL,
	[dest_email] [varchar](50) NULL,
 CONSTRAINT [PK_TH_AMT_LOG_DESTINATION] PRIMARY KEY CLUSTERED 
(
	[tald_type] ASC,
	[tald_soci_code] ASC,
	[tald_code] ASC,
	[dat_trait] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[th_amt_log_instruc_det]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[th_amt_log_instruc_det](
	[Id] [int] NULL,
	[origine] [varchar](20) NULL,
	[cont_num] [int] NULL,
	[cadr_ident] [int] NULL,
	[cdep_datdep] [datetime] NULL,
	[date_ligne] [datetime] NULL,
	[sect_code] [smallint] NULL,
	[valeur] [varchar](30) NULL,
	[rese_ident] [int] NULL,
	[depa_code] [char](2) NULL,
	[aggl_numord] [int] NULL,
	[afch_ident] [int] NULL,
	[theme] [varchar](50) NULL,
	[sect_code_centre] [int] NULL,
	[form_larg] [smallint] NULL,
	[form_haut] [smallint] NULL,
	[tyaf_code] [int] NULL,
	[talr_trait] [char](1) NOT NULL,
	[dat_trait] [datetime] NULL,
	[type_instruction] [varchar](20) NULL,
	[cont_anbas] [int] NULL,
	[cont_sembas] [int] NULL,
	[cadre_lib] [varchar](30) NULL,
	[IdFaceOTAffichage] [int] NULL,
	[IdTypePreparation] [int] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[th_amt_log_instruction]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[th_amt_log_instruction](
	[Id] [int] NULL,
	[type_instruction] [varchar](20) NULL,
	[rese_ident] [int] NULL,
	[cont_num] [int] NULL,
	[nom] [varchar](30) NULL,
	[date_ligne] [datetime] NULL,
	[afch_ident] [int] NULL,
	[theme] [varchar](50) NULL,
	[sect_code_centre] [int] NULL,
	[pourcentage] [decimal](6, 2) NULL,
	[form_larg] [smallint] NULL,
	[form_haut] [smallint] NULL,
	[tyaf_code] [int] NULL,
	[typr_code] [int] NULL,
	[cont_anbas] [int] NULL,
	[cont_sembas] [int] NULL,
	[talr_trait] [char](1) NOT NULL,
	[dat_trait] [datetime] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[th_amt_log_repart]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[th_amt_log_repart](
	[rpch_id] [numeric](18, 0) IDENTITY(1,1) NOT NULL,
	[repa_ident] [numeric](9, 0) NOT NULL,
	[rpfo_ident] [numeric](9, 0) NOT NULL,
	[pers_ident] [numeric](9, 0) NOT NULL,
	[tyaf_code] [smallint] NOT NULL,
	[pers_nom] [varchar](50) NOT NULL,
	[tald_type] [char](2) NOT NULL,
	[tald_soci_code] [tinyint] NOT NULL,
	[tald_code] [numeric](9, 0) NOT NULL,
	[reac_code] [tinyint] NOT NULL,
	[typr_code] [tinyint] NOT NULL,
	[rpli_datdep] [smalldatetime] NOT NULL,
	[rpli_anbas] [smallint] NOT NULL,
	[rpli_sembas] [tinyint] NOT NULL,
	[soci_code] [tinyint] NOT NULL,
	[sect_code] [smallint] NOT NULL,
	[afch_ident] [numeric](9, 0) NOT NULL,
	[afch_lib] [varchar](255) NOT NULL,
	[cont_num] [int] NULL,
	[cont_annonc] [varchar](30) NULL,
	[rpty_qte_affich] [int] NULL,
	[talr_trait] [char](1) NULL,
	[dat_trait] [datetime] NOT NULL,
 CONSTRAINT [PK_TH_AMT_LOG_REPART] PRIMARY KEY CLUSTERED 
(
	[rpch_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[th_amt_log_statut_repart]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[th_amt_log_statut_repart](
	[repa_ident] [int] NOT NULL,
	[statut] [int] NOT NULL,
	[date_statut] [datetime] NOT NULL,
	[talr_trait] [char](1) NOT NULL,
	[cont_num] [int] NOT NULL,
	[rpfo_ident] [int] NOT NULL,
	[cont_datbas] [smallint] NOT NULL,
	[cont_sembas] [smallint] NOT NULL,
	[typr_code] [smallint] NULL,
	[dat_trait] [datetime] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[th_amt_log_train]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[th_amt_log_train](
	[cadr_ident] [numeric](9, 0) NOT NULL,
	[rdep_datdep] [smalldatetime] NOT NULL,
	[empl_ident] [numeric](9, 0) NULL,
	[pers_ident] [numeric](9, 0) NULL,
	[pers_nom] [varchar](50) NULL,
	[tyaf_code] [smallint] NULL,
	[reac_code] [tinyint] NULL,
	[typr_code] [tinyint] NULL,
	[cont_sembas] [tinyint] NULL,
	[cont_anbas] [smallint] NULL,
	[cont_num] [int] NULL,
	[cont_annonc] [varchar](30) NULL,
	[tald_type] [char](2) NULL,
	[tald_soci_code] [tinyint] NULL,
	[tald_code] [numeric](9, 0) NULL,
	[empl_sect_code] [smallint] NULL,
	[empl_depa_code] [char](2) NULL,
	[comm_numord] [smallint] NULL,
	[empl_numord] [smallint] NULL,
	[empl_addresse1] [varchar](30) NULL,
	[empl_addresse2] [varchar](30) NULL,
	[empl_addresse3] [varchar](30) NULL,
	[cadr_lettre] [char](1) NULL,
	[form_larg] [smallint] NULL,
	[form_haut] [smallint] NULL,
	[agreement] [varchar](50) NULL,
	[sect_code_prepa] [smallint] NULL,
	[train] [tinyint] NULL,
	[rang] [tinyint] NULL,
	[rese_ident] [numeric](9, 0) NULL,
	[idre_nom] [varchar](50) NULL,
	[panel_ident] [numeric](9, 0) NULL,
	[talr_trait] [char](1) NOT NULL,
	[dat_trait] [datetime] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[th_repart_annule]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[th_repart_annule](
	[ident] [int] IDENTITY(1,1) NOT NULL,
	[repa_ident] [int] NULL,
	[cont_num] [int] NULL,
	[typr_lib] [varchar](20) NULL,
	[cont_annonc] [varchar](30) NULL,
	[rpfo_qte_reserv] [int] NULL,
	[cont_anbas] [int] NULL,
	[cont_sembas] [int] NULL,
	[loginWindows] [varchar](50) NULL,
	[date_annulation] [datetime] NULL,
	[IdGroupePreparation] [int] NULL,
	[IdSiteCCF] [int] NULL,
 CONSTRAINT [pk_th_repart_annule] PRIMARY KEY CLUSTERED 
(
	[ident] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tmp_instruction_train]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tmp_instruction_train](
	[instr_code] [varchar](18) NOT NULL,
	[ate_id] [smallint] NULL,
	[tsr_repart_code] [tinyint] NULL,
	[rpc_statut] [tinyint] NULL,
	[instr_type_instruction] [varchar](20) NULL,
	[rese_ident] [int] NULL,
	[cont_num] [int] NULL,
	[instr_annonceur] [varchar](30) NULL,
	[cont_anbas] [smallint] NULL,
	[cont_sembas] [smallint] NULL,
	[instr_commentaire] [varchar](100) NULL,
	[instr_dat_cre] [datetime] NULL,
	[instr_dat_maj] [datetime] NULL,
	[instr_user] [varchar](20) NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tmp_tf_colis]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tmp_tf_colis](
	[colis_id] [int] IDENTITY(1,1) NOT NULL,
	[fc_col_id] [int] NULL,
	[colis_code] [varchar](20) NULL,
	[rpc_statut] [tinyint] NULL,
	[dest_id] [int] NULL,
	[ate_id] [smallint] NULL,
	[colis_user] [varchar](20) NULL,
	[colis_dat_cre] [datetime] NULL,
	[colis_dat_maj] [datetime] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tmp_tr_dest_adresse]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tmp_tr_dest_adresse](
	[adr_id] [int] NOT NULL,
	[dest_id] [int] NULL,
	[tad_cod] [varchar](10) NULL,
	[adr_principale] [char](1) NOT NULL,
	[adr_num_voie] [varchar](50) NULL,
	[adr_type_voie] [varchar](50) NULL,
	[adr_voie] [varchar](100) NULL,
	[adr_lieu_dit] [varchar](50) NULL,
	[adr_localite] [varchar](50) NULL,
	[adr_code_postal] [varchar](5) NULL,
	[adr_cedex] [varchar](50) NULL,
	[adr_dat_maj] [datetime] NULL,
	[adr_dat_cre] [datetime] NULL,
	[adr_user_maj] [varchar](30) NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tmp_tr_destinataire]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tmp_tr_destinataire](
	[dest_id] [int] IDENTITY(1,1) NOT NULL,
	[dest_nom_ori] [varchar](50) NOT NULL,
	[dest_nom] [varchar](50) NULL,
	[dest_actif] [bit] NOT NULL,
	[dest_user] [varchar](30) NULL,
	[dest_dat_cre] [datetime] NULL,
	[dest_dat_maj] [datetime] NULL,
	[dest_dispatch] [char](1) NULL,
	[des_id] [numeric](9, 0) NULL,
	[des_type] [tinyint] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tmp_tr_transporteur]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tmp_tr_transporteur](
	[tsp_id] [numeric](9, 0) NOT NULL,
	[tsp_nom] [varchar](50) NOT NULL,
	[tsp_ip_exp_man] [varchar](50) NULL,
	[tsp_file_exp_man] [varchar](30) NULL,
	[tsp_ip_exp_auto] [varchar](50) NULL,
	[tsp_file_exp_auto] [varchar](30) NULL,
	[tsp_ip_imp] [char](15) NULL,
	[tsp_file_imp] [varchar](30) NULL,
	[tsp_bac] [tinyint] NOT NULL,
	[tsp_pos_impr] [tinyint] NOT NULL,
	[tsp_ligne_tri] [tinyint] NOT NULL,
	[tsp_user] [char](8) NOT NULL,
	[tsp_dat_cre] [smalldatetime] NOT NULL,
	[tsp_dat_maj] [smalldatetime] NOT NULL,
	[tsp_suivi_link] [varchar](300) NULL,
	[tsp_suivi_link_fin] [varchar](300) NULL,
	[tsp_suivi_contact] [varchar](200) NULL,
	[tsp_suivi_texte] [varchar](300) NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tmp_tr_transporteur_atelier]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tmp_tr_transporteur_atelier](
	[tsp_id] [numeric](9, 0) NULL,
	[ate_id] [smallint] NULL,
	[tra_ip] [varchar](50) NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_activite]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_activite](
	[act_id] [smallint] NOT NULL,
	[act_nom] [varchar](50) NOT NULL,
	[act_user] [char](8) NOT NULL,
	[act_dat_cre] [smalldatetime] NOT NULL,
	[act_dat_maj] [dbo].[t_dat_sys] NOT NULL,
 CONSTRAINT [PK_TR_ACTIVITE] PRIMARY KEY CLUSTERED 
(
	[act_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_adresseMail_plateforme]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_adresseMail_plateforme](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[plt_id] [tinyint] NULL,
	[adresseMail] [varchar](50) NULL,
	[user_creation] [varchar](50) NULL,
	[date_creation] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_agence_geodis]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_agence_geodis](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Agence] [varchar](50) NOT NULL,
	[Compte] [varchar](50) NULL,
	[EstActive] [bit] NOT NULL,
 CONSTRAINT [PK_tr_agence_geodis] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_ate_dest_trans]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_ate_dest_trans](
	[dest_id] [int] NOT NULL,
	[tsp_id] [int] NOT NULL,
	[tarif_code] [varchar](20) NOT NULL,
	[ate_id] [smallint] NOT NULL,
 CONSTRAINT [PK_TR_ATE_DEST_TRANS] PRIMARY KEY CLUSTERED 
(
	[dest_id] ASC,
	[tsp_id] ASC,
	[tarif_code] ASC,
	[ate_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_atelier]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_atelier](
	[ate_id] [smallint] NOT NULL,
	[plt_id] [tinyint] NOT NULL,
	[ate_lib] [varchar](50) NOT NULL,
	[ate_code_amt] [tinyint] NOT NULL,
	[ate_user] [char](8) NOT NULL,
	[ate_dat_cre] [smalldatetime] NOT NULL,
	[ate_dat_maj] [smalldatetime] NOT NULL,
	[ate_type] [tinyint] NOT NULL,
 CONSTRAINT [PK_TR_ATELIER] PRIMARY KEY CLUSTERED 
(
	[ate_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_atelier_droit_prepa]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_atelier_droit_prepa](
	[adp_id] [int] IDENTITY(1,1) NOT NULL,
	[ate_id] [smallint] NOT NULL,
	[tpr_id] [smallint] NULL,
	[IdSurface] [int] NULL,
	[adp_exclusion] [bit] NOT NULL,
	[adp_user] [varchar](20) NOT NULL,
	[adp_dat_cre] [datetime] NOT NULL,
	[adp_dat_maj] [datetime] NOT NULL,
 CONSTRAINT [PK_TR_ATELIER_DROIT_PREPA] PRIMARY KEY CLUSTERED 
(
	[adp_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_tr_atelier_droit_prepa] UNIQUE NONCLUSTERED 
(
	[ate_id] ASC,
	[tpr_id] ASC,
	[IdSurface] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_atelier_imprimante]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_atelier_imprimante](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[IdPlatforme] [tinyint] NOT NULL,
	[NomImprimante] [varchar](50) NULL,
 CONSTRAINT [PK_tr_atelier_imprimante] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_atelier_support]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_atelier_support](
	[sup_id] [smallint] NOT NULL,
	[ate_id] [smallint] NOT NULL,
	[ats_dat_deb] [datetime] NOT NULL,
	[ats_dat_fin] [datetime] NULL,
	[ats_actif] [tinyint] NOT NULL,
	[ats_user] [char](8) NOT NULL,
	[ats_dat_cre] [smalldatetime] NOT NULL,
	[ats_dat_maj] [smalldatetime] NOT NULL,
 CONSTRAINT [PK_TR_ATELIER_SUPPORT] PRIMARY KEY CLUSTERED 
(
	[sup_id] ASC,
	[ate_id] ASC,
	[ats_dat_deb] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_commune]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_commune](
	[depa_code] [varchar](2) NOT NULL,
	[comm_numord] [int] NOT NULL,
	[comm_nom] [varchar](50) NOT NULL,
 CONSTRAINT [PK_TR_COMMUNE] PRIMARY KEY CLUSTERED 
(
	[depa_code] ASC,
	[comm_numord] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_communes_calber]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_communes_calber](
	[calb_id] [int] IDENTITY(1,1) NOT NULL,
	[calb_postal] [varchar](20) NOT NULL,
	[calb_commune] [varchar](100) NOT NULL,
 CONSTRAINT [PK_TR_COMMUNES_CALBER] PRIMARY KEY CLUSTERED 
(
	[calb_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_dest_adresse]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_dest_adresse](
	[adr_id] [int] IDENTITY(1,1) NOT NULL,
	[dest_id] [int] NULL,
	[tad_cod] [varchar](10) NULL,
	[adr_principale] [char](1) NOT NULL,
	[adr_num_voie] [varchar](50) NULL,
	[adr_type_voie] [varchar](50) NULL,
	[adr_voie] [varchar](100) NULL,
	[adr_lieu_dit] [varchar](50) NULL,
	[adr_localite] [varchar](50) NULL,
	[adr_code_postal] [varchar](5) NULL,
	[adr_cedex] [varchar](50) NULL,
	[adr_dat_maj] [datetime] NULL,
	[adr_dat_cre] [datetime] NULL,
	[adr_user_maj] [varchar](30) NULL,
	[calb_id] [int] NULL,
	[IdAdresse] [int] NULL,
 CONSTRAINT [PK_TR_DEST_ADRESSE] PRIMARY KEY CLUSTERED 
(
	[adr_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_destinataire]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_destinataire](
	[dest_id] [int] IDENTITY(1,1) NOT NULL,
	[dest_nom_ori] [varchar](50) NOT NULL,
	[dest_nom] [varchar](50) NULL,
	[dest_actif] [bit] NOT NULL,
	[dest_dispatch] [char](1) NULL,
	[des_id] [numeric](9, 0) NULL,
	[des_type] [tinyint] NULL,
	[dest_user] [varchar](30) NULL,
	[des_mail] [varchar](50) NULL,
	[des_NumTel] [varchar](50) NULL,
	[des_PexId] [int] NULL,
	[dest_dat_cre] [datetime] NULL,
	[dest_dat_maj] [datetime] NULL,
 CONSTRAINT [PK_TR_DESTINATAIRE] PRIMARY KEY CLUSTERED 
(
	[dest_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_destination]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_destination](
	[des_id] [numeric](9, 0) NOT NULL,
	[des_type] [tinyint] NOT NULL,
	[des_type_adr] [tinyint] NOT NULL,
	[tsp_id] [numeric](9, 0) NOT NULL,
	[des_nom] [varchar](50) NOT NULL,
	[des_actif] [tinyint] NOT NULL,
	[des_adr_1] [varchar](50) NULL,
	[des_adr_2] [varchar](50) NULL,
	[des_adr_3] [varchar](50) NULL,
	[des_postal] [char](5) NULL,
	[des_localite] [varchar](50) NULL,
	[des_tel] [varchar](15) NULL,
	[des_fax] [varchar](15) NULL,
	[des_mail] [varchar](30) NULL,
	[des_user] [char](8) NOT NULL,
	[des_dat_cre] [smalldatetime] NOT NULL,
	[des_dat_maj] [smalldatetime] NOT NULL,
	[des_dispatch] [char](1) NULL,
 CONSTRAINT [PK_TR_DESTINATION] PRIMARY KEY CLUSTERED 
(
	[des_id] ASC,
	[des_type] ASC,
	[des_type_adr] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_format_colis]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_format_colis](
	[fc_col_id] [int] NOT NULL,
	[fc_col_desc] [varchar](30) NOT NULL,
 CONSTRAINT [PK_TR_FORMAT_COLIS] PRIMARY KEY CLUSTERED 
(
	[fc_col_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_imprimeur]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_imprimeur](
	[id] [numeric](9, 0) IDENTITY(1,1) NOT NULL,
	[libelle] [varchar](150) NULL,
	[contact_Imprimeur] [varchar](150) NULL,
	[adresse1_Imprimeur] [varchar](150) NULL,
	[adresse2_Imprimeur] [varchar](150) NULL,
	[ville_Imprimeur] [varchar](150) NULL,
	[cp_Imprimeur] [varchar](150) NULL,
	[pays_Imprimeur] [varchar](150) NULL,
	[telephone_Imprimeur] [varchar](150) NULL,
	[fax_Imprimeur] [varchar](150) NULL,
	[messagerie_Imprimeur] [varchar](150) NULL,
 CONSTRAINT [tr_imprimeurs] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_instruction_plus]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_instruction_plus](
	[tip_ins_code] [tinyint] NOT NULL,
	[tip_ins_lib] [varchar](30) NOT NULL,
 CONSTRAINT [PK_TR_INSTRUCTION_PLUS] PRIMARY KEY CLUSTERED 
(
	[tip_ins_code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_jour_depart]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_jour_depart](
	[jour_depart_id] [int] IDENTITY(1,1) NOT NULL,
	[libelle] [varchar](30) NOT NULL,
	[qui_creation] [varchar](30) NULL,
	[date_creation] [datetime] NULL,
	[qui_modification] [varchar](30) NULL,
	[date_modification] [datetime] NULL,
 CONSTRAINT [PK_jour_depart] PRIMARY KEY CLUSTERED 
(
	[jour_depart_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_lien_cote_cote]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_lien_cote_cote](
	[IdLienCoteCote] [int] NOT NULL,
	[Position] [varchar](50) NOT NULL,
	[IdTypeDeRegroupement] [int] NULL,
 CONSTRAINT [PK_tr_lien_cote_cote] PRIMARY KEY CLUSTERED 
(
	[IdLienCoteCote] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_parametre_alternance]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_parametre_alternance](
	[parametre_id] [int] IDENTITY(1,1) NOT NULL,
	[code] [varchar](255) NOT NULL,
	[valeur] [varchar](255) NOT NULL,
	[description] [varchar](255) NULL,
	[est_inclus] [bit] NOT NULL,
	[est_actif] [bit] NOT NULL,
 CONSTRAINT [PK_Parametre] PRIMARY KEY CLUSTERED 
(
	[parametre_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_plateforme]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_plateforme](
	[plt_id] [tinyint] NOT NULL,
	[plt_nom] [varchar](50) NOT NULL,
	[plt_adr_1] [varchar](50) NULL,
	[plt_adr_2] [varchar](50) NULL,
	[plt_postal] [char](5) NULL,
	[plt_localite] [varchar](50) NULL,
	[plt_tel] [char](14) NULL,
	[plt_user] [char](8) NOT NULL,
	[plt_dat_cre] [smalldatetime] NOT NULL,
	[plt_dat_maj] [smalldatetime] NOT NULL,
	[plt_mail] [varchar](500) NULL,
	[id_site_ccf] [int] NULL,
 CONSTRAINT [PK_TR_PLATEFORME] PRIMARY KEY CLUSTERED 
(
	[plt_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_poste]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_poste](
	[poste_id] [int] IDENTITY(1,1) NOT NULL,
	[plt_id] [tinyint] NULL,
	[ate_id] [smallint] NULL,
	[poste_nom] [varchar](50) NULL,
	[poste_ip] [varchar](50) NULL,
	[poste_calber] [varchar](50) NULL,
	[poste_imp_ccf] [varchar](50) NULL,
 CONSTRAINT [PK_TR_POSTE] PRIMARY KEY CLUSTERED 
(
	[poste_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_profil]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_profil](
	[prf_id] [int] IDENTITY(1,1) NOT NULL,
	[prf_lib] [varchar](30) NULL,
 CONSTRAINT [pk_tr_profil] PRIMARY KEY CLUSTERED 
(
	[prf_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_rouleur]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_rouleur](
	[rouleur_id] [int] IDENTITY(1,1) NOT NULL,
	[ate_id] [smallint] NULL,
	[rouleur_nom] [varchar](50) NOT NULL,
	[rouleur_date_fin] [datetime] NULL,
 CONSTRAINT [PK_TR_ROULEUR] PRIMARY KEY CLUSTERED 
(
	[rouleur_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_societe]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_societe](
	[soc_id] [tinyint] NOT NULL,
	[soc_nom] [varchar](50) NULL,
	[soc_user] [char](8) NOT NULL,
	[soc_dat_cre] [smalldatetime] NOT NULL,
	[soc_dat_maj] [smalldatetime] NOT NULL,
 CONSTRAINT [PK_TR_SOCIETE] PRIMARY KEY CLUSTERED 
(
	[soc_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_statut]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_statut](
	[rpc_statut] [tinyint] NOT NULL,
	[statut_nom] [varchar](30) NOT NULL,
 CONSTRAINT [PK_TR_STATUT] PRIMARY KEY CLUSTERED 
(
	[rpc_statut] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_statut_colis]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_statut_colis](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Libelle] [varchar](50) NOT NULL,
	[Ordre] [int] NOT NULL,
 CONSTRAINT [PK_tr_statut_colis] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_statut_repart]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_statut_repart](
	[tsr_repart_code] [tinyint] NOT NULL,
	[tsr_repart_nom] [varchar](30) NOT NULL,
 CONSTRAINT [PK_TR_STATUT_REPART] PRIMARY KEY CLUSTERED 
(
	[tsr_repart_code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_train_convention_a_trier]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_train_convention_a_trier](
	[IdContratFournisseur] [int] NOT NULL,
	[Reference] [varchar](50) NULL,
	[DateDebutApplication] [date] NULL,
	[DateFinApplication] [date] NULL,
 CONSTRAINT [PK_tr_train_convention_a_trier] PRIMARY KEY CLUSTERED 
(
	[IdContratFournisseur] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_trans_tarif]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_trans_tarif](
	[tsp_id] [int] NOT NULL,
	[tarif_code] [varchar](20) NOT NULL,
	[tarif_expediteur] [varchar](20) NULL,
	[tarif_code_fac_client] [varchar](20) NULL,
	[tarif_incoterm] [varchar](20) NULL,
	[tarif_type_edition] [varchar](20) NULL,
	[tarif_regroupement] [varchar](20) NULL,
 CONSTRAINT [PK_TR_TRANSTARIF] PRIMARY KEY CLUSTERED 
(
	[tsp_id] ASC,
	[tarif_code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_transporteur]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_transporteur](
	[tsp_id] [int] NOT NULL,
	[tsp_nom] [varchar](50) NOT NULL,
	[tsp_interne] [char](1) NULL,
	[tsp_inactif] [char](1) NULL,
	[cle_Api] [varchar](50) NULL,
	[id_Api] [varchar](50) NULL,
 CONSTRAINT [PK_TR_TRANSPORTEUR] PRIMARY KEY CLUSTERED 
(
	[tsp_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_transporteur_atelier]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_transporteur_atelier](
	[tsp_id] [int] NOT NULL,
	[ate_id] [smallint] NOT NULL,
	[tra_ip] [varchar](50) NULL,
	[tra_code_tiers] [varchar](50) NULL,
	[tra_lien_suivi] [varchar](500) NULL,
 CONSTRAINT [PK_TR_TRANSPORTEUR_ATELIER] PRIMARY KEY CLUSTERED 
(
	[tsp_id] ASC,
	[ate_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_transposteur_reception]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_transposteur_reception](
	[id] [numeric](9, 0) IDENTITY(1,1) NOT NULL,
	[libelle] [varchar](150) NULL,
 CONSTRAINT [tr_transposteur_receptions] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[TR_tri_cote_cote]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TR_tri_cote_cote](
	[IdTri] [int] NOT NULL,
	[LibelleTri] [varchar](50) NOT NULL,
	[TypeTri] [varchar](50) NOT NULL,
 CONSTRAINT [PK_TR_Tri_Cote_Cote] PRIMARY KEY CLUSTERED 
(
	[IdTri] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_typ_aff_amt]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_typ_aff_amt](
	[taf_amt] [numeric](9, 0) NOT NULL,
	[tpr_id] [smallint] NOT NULL,
 CONSTRAINT [PK_TR_TYP_AFF_AMT] PRIMARY KEY CLUSTERED 
(
	[taf_amt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_type_adresse]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_type_adresse](
	[tad_cod] [varchar](10) NOT NULL,
	[tad_lib] [varchar](20) NOT NULL,
 CONSTRAINT [PK_TR_TYPE_ADRESSE] PRIMARY KEY CLUSTERED 
(
	[tad_cod] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_type_anomalie]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_type_anomalie](
	[tan_id] [numeric](9, 0) NOT NULL,
	[tan_lib] [varchar](255) NOT NULL,
	[tan_user] [char](8) NOT NULL,
	[tan_dat_cre] [smalldatetime] NOT NULL,
	[tan_dat_maj] [smalldatetime] NOT NULL,
 CONSTRAINT [PK_TR_TYPE_ANOMALIE] PRIMARY KEY CLUSTERED 
(
	[tan_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_type_destination]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_type_destination](
	[des_type] [tinyint] NOT NULL,
	[type_nom] [varchar](20) NOT NULL,
	[IdTypeDestinationDA] [int] NULL,
 CONSTRAINT [PK_TR_TYPE_DESTINATION] PRIMARY KEY CLUSTERED 
(
	[des_type] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_type_dossier]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_type_dossier](
	[IdTypeDossier] [int] NOT NULL,
	[Libelle] [varchar](50) NULL,
 CONSTRAINT [PK_type_dossier] PRIMARY KEY CLUSTERED 
(
	[IdTypeDossier] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_type_entite]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_type_entite](
	[IdTypeEntite] [int] IDENTITY(1,1) NOT NULL,
	[Libelle] [varchar](50) NOT NULL,
	[QuiCreation] [varchar](20) NULL,
	[DateCreation] [datetime] NULL,
	[QuiModification] [varchar](20) NULL,
	[DateModification] [datetime] NULL,
 CONSTRAINT [PK_TypeEntite] PRIMARY KEY CLUSTERED 
(
	[IdTypeEntite] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_type_preparation]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_type_preparation](
	[tpr_id] [smallint] NOT NULL,
	[tpr_lib] [varchar](50) NOT NULL,
	[tpr_user] [varchar](20) NOT NULL,
	[tpr_dat_cre] [smalldatetime] NOT NULL,
	[tpr_dat_maj] [dbo].[t_dat_sys] NOT NULL,
 CONSTRAINT [PK_TR_TYPE_PREPARATION] PRIMARY KEY CLUSTERED 
(
	[tpr_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_utilisateur]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_utilisateur](
	[loginWindows] [varchar](50) NOT NULL,
	[ate_id] [smallint] NULL,
	[prf_id] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[loginWindows] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_utilisateur_data]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_utilisateur_data](
	[loginWindows] [varchar](50) NOT NULL,
	[plt_id] [tinyint] NOT NULL,
	[ate_id] [smallint] NOT NULL,
 CONSTRAINT [PK_TR_UTILISATEUR_DATA] PRIMARY KEY CLUSTERED 
(
	[loginWindows] ASC,
	[ate_id] ASC,
	[plt_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tr_utilisateur_menu]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tr_utilisateur_menu](
	[loginWindows] [varchar](50) NOT NULL,
	[menu] [varchar](50) NOT NULL,
 CONSTRAINT [PK_TR_UTILISATEUR_MENU] PRIMARY KEY CLUSTERED 
(
	[loginWindows] ASC,
	[menu] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tra_amt_log_instruc_det]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS OFF
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tra_amt_log_instruc_det](
	[Id] [int] NULL,
	[origine] [varchar](20) NOT NULL,
	[cont_num] [int] NOT NULL,
	[cadr_ident] [int] NOT NULL,
	[cdep_datdep] [datetime] NOT NULL,
	[date_ligne] [datetime] NOT NULL,
	[sect_code] [smallint] NULL,
	[valeur] [varchar](30) NULL,
	[rese_ident] [int] NULL,
	[depa_code] [char](2) NULL,
	[aggl_numord] [int] NULL,
	[afch_ident] [int] NULL,
	[theme] [varchar](50) NULL,
	[sect_code_centre] [int] NULL,
	[form_larg] [smallint] NULL,
	[form_haut] [smallint] NULL,
	[tyaf_code] [int] NULL,
	[talr_trait] [char](1) NULL,
	[type_instruction] [varchar](20) NULL,
	[cont_anbas] [int] NULL,
	[cont_sembas] [int] NULL,
	[cadre_lib] [varchar](30) NULL,
	[IdFaceOTAffichage] [int] NULL,
	[IdTypePreparation] [int] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tra_amt_log_instruction]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS OFF
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tra_amt_log_instruction](
	[Id] [int] NULL,
	[type_instruction] [varchar](20) NULL,
	[rese_ident] [int] NULL,
	[cont_num] [int] NULL,
	[nom] [varchar](30) NULL,
	[date_ligne] [datetime] NULL,
	[afch_ident] [int] NULL,
	[theme] [varchar](50) NULL,
	[sect_code_centre] [int] NULL,
	[pourcentage] [decimal](6, 2) NULL,
	[form_larg] [smallint] NULL,
	[form_haut] [smallint] NULL,
	[tyaf_code] [int] NULL,
	[typr_code] [int] NULL,
	[cont_anbas] [int] NULL,
	[cont_sembas] [int] NULL,
	[talr_trait] [char](1) NOT NULL,
	[Commentaire] [varchar](255) NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tra_amt_log_statut_repart]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tra_amt_log_statut_repart](
	[repa_ident] [int] NOT NULL,
	[statut] [int] NOT NULL,
	[date_statut] [datetime] NOT NULL,
	[talr_trait] [char](1) NOT NULL,
	[cont_num] [int] NOT NULL,
	[rpfo_ident] [int] NOT NULL,
	[cont_datbas] [smallint] NOT NULL,
	[cont_sembas] [smallint] NOT NULL,
	[typr_code] [smallint] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tra_amt_log_train]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tra_amt_log_train](
	[cadr_ident] [numeric](9, 0) NOT NULL,
	[rdep_datdep] [smalldatetime] NOT NULL,
	[empl_ident] [numeric](9, 0) NULL,
	[pers_ident] [numeric](9, 0) NULL,
	[pers_nom] [varchar](50) NULL,
	[tyaf_code] [smallint] NULL,
	[reac_code] [tinyint] NULL,
	[typr_code] [tinyint] NULL,
	[cont_sembas] [tinyint] NULL,
	[cont_anbas] [smallint] NULL,
	[cont_num] [int] NULL,
	[cont_annonc] [varchar](30) NULL,
	[tald_type] [char](2) NULL,
	[tald_soci_code] [tinyint] NULL,
	[tald_code] [numeric](9, 0) NULL,
	[empl_sect_code] [smallint] NULL,
	[empl_depa_code] [char](2) NULL,
	[comm_numord] [smallint] NULL,
	[empl_numord] [smallint] NULL,
	[empl_addresse1] [varchar](30) NULL,
	[empl_addresse2] [varchar](30) NULL,
	[empl_addresse3] [varchar](30) NULL,
	[cadr_lettre] [char](1) NULL,
	[form_larg] [smallint] NULL,
	[form_haut] [smallint] NULL,
	[agreement] [varchar](50) NULL,
	[sect_code_prepa] [smallint] NULL,
	[train] [tinyint] NULL,
	[rang] [tinyint] NULL,
	[rese_ident] [numeric](9, 0) NULL,
	[idre_nom] [varchar](50) NULL,
	[panel_ident] [numeric](9, 0) NULL,
	[talr_trait] [char](1) NOT NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Transaco_Surface_Format]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Transaco_Surface_Format](
	[IdSurface] [int] NOT NULL,
	[IdFormat] [int] NOT NULL,
	[sup_id] [int] NULL,
 CONSTRAINT [PK_Surface_Format] PRIMARY KEY CLUSTERED 
(
	[IdSurface] ASC,
	[IdFormat] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[transcoCategSupport]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[transcoCategSupport](
	[sup_id] [int] NOT NULL,
	[tpr_id] [int] NOT NULL,
	[IdSurface] [int] NULL,
	[estBandeau] [bit] NULL,
 CONSTRAINT [PK_transcoCategSupport_supId_tprId] PRIMARY KEY CLUSTERED 
(
	[sup_id] ASC,
	[tpr_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[trav_adresseLivraisonAfficheur]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[trav_adresseLivraisonAfficheur](
	[IdRessource] [int] NOT NULL,
	[DateDebutPivot] [date] NOT NULL,
	[DateFinPivot] [date] NULL,
	[IdAdresse] [int] NULL,
	[Destinataire] [varchar](101) NULL,
	[PointDeRemise] [varchar](50) NULL,
	[NumeroDeVoie] [varchar](50) NULL,
	[TypeDeVoie] [varchar](50) NULL,
	[LibelleVoie] [varchar](100) NULL,
	[LieuDit] [varchar](250) NULL,
	[CodePostal] [varchar](5) NULL,
	[Commune] [varchar](60) NULL,
	[Cedex] [varchar](50) NULL,
	[IdTypeDestinationDA] [int] NULL,
	[IdTiers] [int] NULL,
	[IdDepot] [int] NULL,
	[IdSiteCCF] [int] NULL,
	[des_Mail] [varchar](50) NULL,
	[des_NumTel] [varchar](50) NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[trav_groupePreparation]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[trav_groupePreparation](
	[IdGroupePreparation] [int] NOT NULL,
	[IdReferentielStatut] [int] NOT NULL,
	[IdTypePreparation] [int] NOT NULL,
	[IdFormat] [int] NOT NULL,
	[IdSiteCCF] [int] NOT NULL,
	[Entretien] [int] NOT NULL,
	[Semaine] [int] NOT NULL,
	[AnneeSemaine] [int] NOT NULL,
	[QuiCreation] [varchar](30) NULL,
	[DateCreation] [datetime] NULL,
	[QuiModification] [varchar](30) NULL,
	[DateModification] [datetime] NULL,
	[ReferenceMigration] [varchar](50) NULL,
	[rpc_statut] [int] NULL,
 CONSTRAINT [PK_GroupePreparation] PRIMARY KEY CLUSTERED 
(
	[IdGroupePreparation] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[trav_instruction]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[trav_instruction](
	[IdGroupePreparation] [int] NULL,
	[IdPreparationDetail] [int] NULL,
	[IdTypePreparation] [int] NULL,
	[IdFormat] [int] NULL,
	[IdSiteCCF] [int] NULL,
	[IdDossierDeVenteChapeau] [int] NULL,
	[IdAnnonceur] [int] NULL,
	[AnnonceurLibelle] [varchar](255) NULL,
	[AnneeSemaine] [int] NULL,
	[Semaine] [int] NULL,
	[Entretien] [int] NULL,
	[QuantiteEntretien] [int] NULL,
	[Quantite] [int] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[trav_instructionDetail]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[trav_instructionDetail](
	[IdFaceOTAffichage] [int] NULL,
	[IdFace] [int] NULL,
	[RefFace] [varchar](30) NULL,
	[IdTypePreparation] [int] NULL,
	[IdFormat] [int] NULL,
	[IdTheme] [int] NULL,
	[Description] [varchar](30) NULL,
	[IdThemeBandeau] [int] NULL,
	[DescriptionBandeau] [varchar](30) NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[trav_preparation]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[trav_preparation](
	[IdPreparationChapeau] [int] NULL,
	[IdGroupePreparation] [int] NULL,
	[IdPreparationDetail] [int] NULL,
	[IdDossierDeVenteChapeau] [int] NULL,
	[DatePremierDepart] [datetime] NULL,
	[Annonceur] [varchar](255) NULL,
	[IdTheme] [int] NULL,
	[Theme] [varchar](30) NULL,
	[IdThemeBandeau] [int] NULL,
	[ThemeBandeau] [varchar](30) NULL,
	[IdTypePreparation] [int] NULL,
	[IdFormat] [int] NULL,
	[IdSurface] [int] NULL,
	[IdSiteCCF] [int] NULL,
	[Semaine] [int] NULL,
	[AnneeSemaine] [int] NULL,
	[Quantite] [int] NULL,
	[QuantiteEntretien] [int] NULL,
	[IdRessource] [int] NULL,
	[Nom] [varchar](50) NULL,
	[Prenom] [varchar](50) NULL,
	[IdTypeDestinationDA] [int] NULL,
	[IdDestinataire] [int] NULL,
	[IdAdresse] [int] NULL,
	[rpc_statut] [int] NULL,
	[IdReferentielStatutPreparation] [int] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[trav_preparationDetail]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[trav_preparationDetail](
	[IdPreparationDetail] [int] NOT NULL,
	[IdGroupePreparation] [int] NOT NULL,
	[IdAdresse] [int] NOT NULL,
	[IdTypeDestinationDA] [int] NOT NULL,
	[IdTheme] [int] NULL,
	[IdThemeBandeau] [int] NULL,
	[IdThemeFlap] [int] NULL,
	[Quantite] [int] NOT NULL,
	[QuantiteEntretien] [int] NOT NULL,
	[Destinataire] [varchar](50) NULL,
	[IdRessource] [int] NULL,
	[Afficheur] [varchar](50) NULL,
	[QuiCreation] [varchar](30) NULL,
	[DateCreation] [datetime] NULL,
	[QuiModification] [varchar](30) NULL,
	[DateModification] [datetime] NULL,
	[ReferenceMigration] [varchar](50) NULL,
 CONSTRAINT [PK_PreparationDetail] PRIMARY KEY CLUSTERED 
(
	[IdPreparationDetail] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[trav_theme]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[trav_theme](
	[IdTheme] [int] NOT NULL,
	[IdInstructionChapeau] [int] NOT NULL,
	[IdTypeTheme] [int] NOT NULL,
	[Description] [varchar](30) NULL,
	[Photo] [varchar](255) NULL,
	[QuiCreation] [varchar](30) NULL,
	[DateCreation] [datetime] NULL,
	[QuiModification] [varchar](30) NULL,
	[DateModification] [datetime] NULL,
	[ReferenceMigration] [varchar](50) NULL,
 CONSTRAINT [PK_Theme] PRIMARY KEY CLUSTERED 
(
	[IdTheme] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[trav_trainAffiche]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[trav_trainAffiche](
	[Id] [int] NULL,
	[IdFaceOTAffichage] [int] NULL,
	[IdFace] [int] NULL,
	[RefFace] [varchar](30) NULL,
	[IdFormat] [int] NULL,
	[IdSurface] [int] NULL,
	[DateDepart] [datetime] NULL,
	[IdLocalisation] [int] NULL,
	[IdStructure] [int] NULL,
	[IdPanel] [int] NULL,
	[IdRessource] [int] NULL,
	[Nom] [varchar](50) NULL,
	[Prenom] [varchar](50) NULL,
	[EstInterne] [bit] NOT NULL,
	[IdUniversContractuel] [int] NULL,
	[IdTypePreparation] [int] NULL,
	[AnneeSemaine] [int] NULL,
	[Semaine] [int] NULL,
	[IdDossierDeVenteChapeau] [int] NULL,
	[IdAnnonceur] [int] NULL,
	[AnnonceurLibelle] [varchar](255) NULL,
	[IdTypeDestinationDA] [int] NULL,
	[IdDestinataire] [int] NULL,
	[IdAdresseDestinataire] [int] NULL,
	[IdAdressePat] [int] NULL,
	[IdTypeVoie] [int] NULL,
	[TypeVoieLibelle] [varchar](50) NULL,
	[IdCommune] [int] NULL,
	[CommuneNom] [varchar](50) NULL,
	[NumeroDeVoie] [varchar](50) NULL,
	[Voie] [varchar](100) NULL,
	[BoitePostale] [varchar](50) NULL,
	[LieuDit] [varchar](250) NULL,
	[PointDeRemise] [varchar](50) NULL,
	[CodePostalLibre] [varchar](5) NULL,
	[Localite] [varchar](50) NULL,
	[IdPDVFace] [int] NULL,
	[IdEspace] [int] NULL,
	[EspaceNom] [varchar](50) NULL,
	[NumeroOrdre] [int] NULL,
	[PositionTrainOrigine] [smallint] NULL,
	[PositionTrainModifie] [smallint] NULL,
	[IdSiteCCF] [int] NULL,
	[Traitement] [char](1) NULL,
	[Conservation] [int] NULL,
	[RegionCCF] [varchar](50) NULL,
	[CoteCote] [tinyint] NULL,
	[Convention] [varchar](50) NULL,
	[RefConvention] [varchar](50) NULL,
	[IdTypeDossier] [int] NULL,
	[IdLienCoteCote] [int] NULL,
	[IdPanelDestination] [int] NULL,
	[RefPanel] [varchar](50) NULL,
	[IdProduit] [int] NULL,
	[IdJourDepart] [int] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tt_batch]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tt_batch](
	[bat_batch] [sysname] NOT NULL,
	[bat_step] [tinyint] NOT NULL,
	[bat_statut] [char](2) NOT NULL,
	[bat_dat_exec] [smalldatetime] NOT NULL,
 CONSTRAINT [PK_TT_BATCH] PRIMARY KEY CLUSTERED 
(
	[bat_batch] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tt_log]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tt_log](
	[log_id] [numeric](10, 0) IDENTITY(1,1) NOT NULL,
	[log_date] [datetime] NOT NULL,
	[log_module] [varchar](50) NOT NULL,
	[log_desc] [varchar](255) NOT NULL,
	[log_acteur] [varchar](50) NULL,
 CONSTRAINT [PK_TT_LOG] PRIMARY KEY CLUSTERED 
(
	[log_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tw_amt_log_destination]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tw_amt_log_destination](
	[tald_type] [char](2) NOT NULL,
	[tald_soci_code] [tinyint] NOT NULL,
	[tald_code] [numeric](9, 0) NOT NULL,
	[dest_nom] [varchar](50) NOT NULL,
	[dest_numvoie] [smallint] NULL,
	[dest_voie] [varchar](26) NULL,
	[dest_voiesuite] [varchar](26) NULL,
	[dest_codpost] [int] NULL,
	[dest_commune] [varchar](26) NULL,
	[dest_burdistrib] [varchar](26) NULL,
	[dest_tel] [varchar](15) NULL,
	[dest_fax] [varchar](15) NULL,
	[dest_email] [varchar](50) NULL,
	[dest_trait] [char](1) NULL,
 CONSTRAINT [PK_TW_AMT_LOG_DESTINATION] PRIMARY KEY CLUSTERED 
(
	[tald_type] ASC,
	[tald_soci_code] ASC,
	[tald_code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tw_amt_log_repart]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tw_amt_log_repart](
	[tw_id] [numeric](9, 0) IDENTITY(1,1) NOT NULL,
	[repa_ident] [numeric](9, 0) NOT NULL,
	[rpfo_ident] [numeric](9, 0) NOT NULL,
	[pers_ident] [numeric](9, 0) NOT NULL,
	[tyaf_code] [smallint] NOT NULL,
	[pers_nom] [varchar](50) NOT NULL,
	[tald_type] [char](2) NOT NULL,
	[tald_soci_code] [tinyint] NOT NULL,
	[tald_code] [numeric](9, 0) NOT NULL,
	[reac_code] [tinyint] NOT NULL,
	[typr_code] [tinyint] NOT NULL,
	[rpli_datdep] [smalldatetime] NOT NULL,
	[rpli_anbas] [smallint] NOT NULL,
	[rpli_sembas] [tinyint] NOT NULL,
	[soci_code] [tinyint] NOT NULL,
	[sect_code] [smallint] NOT NULL,
	[afch_ident] [numeric](9, 0) NOT NULL,
	[afch_lib] [varchar](255) NOT NULL,
	[cont_num] [int] NULL,
	[cont_annonc] [varchar](30) NULL,
	[rpty_qte_affich] [int] NULL,
	[talr_trait] [char](1) NULL,
 CONSTRAINT [PK_TW_AMT_LOG_REPART] PRIMARY KEY CLUSTERED 
(
	[tw_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[TypePreparation]    Script Date: 03/11/2026 10:34:25 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TypePreparation](
	[IdTypePreparation] [int] NOT NULL,
	[IdCategoriePreparation] [int] NOT NULL,
	[Libelle] [varchar](50) NOT NULL,
	[QuiCreation] [varchar](30) NULL,
	[DateCreation] [datetime] NULL,
	[QuiModification] [varchar](30) NULL,
	[DateModification] [datetime] NULL,
	[ReferenceMigration] [varchar](50) NULL,
	[tpr_id] [smallint] NULL,
 CONSTRAINT [PK_TypePreparation] PRIMARY KEY CLUSTERED 
(
	[IdTypePreparation] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
ALTER TABLE [dbo].[ARCH_tf_face_train] ADD  DEFAULT ((0)) FOR [pre_assemblage]
GO
ALTER TABLE [dbo].[tf_face_train] ADD  DEFAULT ((0)) FOR [pre_assemblage]
GO
ALTER TABLE [dbo].[tr_atelier_droit_prepa] ADD  CONSTRAINT [DF_tr_atelier_droit_prepa_exclusion]  DEFAULT ((0)) FOR [adp_exclusion]
GO
ALTER TABLE [dbo].[tr_atelier_droit_prepa] ADD  CONSTRAINT [DF_tr_atelier_droit_prepa_dat_cre]  DEFAULT (getdate()) FOR [adp_dat_cre]
GO
ALTER TABLE [dbo].[tr_atelier_droit_prepa] ADD  CONSTRAINT [DF_tr_atelier_droit_prepa_dat_maj]  DEFAULT (getdate()) FOR [adp_dat_maj]
GO
ALTER TABLE [dbo].[TypePreparation] ADD  DEFAULT ((1)) FOR [IdCategoriePreparation]
GO
ALTER TABLE [dbo].[Activite]  WITH CHECK ADD  CONSTRAINT [FK_Activite_ref_Affiche] FOREIGN KEY([IdAffiche])
REFERENCES [dbo].[affiche] ([affiche_id])
GO
ALTER TABLE [dbo].[Activite] CHECK CONSTRAINT [FK_Activite_ref_Affiche]
GO
ALTER TABLE [dbo].[Activite]  WITH CHECK ADD  CONSTRAINT [FK_Activite_ref_Affiche_initial] FOREIGN KEY([id_affiche_initial])
REFERENCES [dbo].[affiche] ([affiche_id])
GO
ALTER TABLE [dbo].[Activite] CHECK CONSTRAINT [FK_Activite_ref_Affiche_initial]
GO
ALTER TABLE [dbo].[Activite]  WITH CHECK ADD  CONSTRAINT [FK_Activite_ref_Equipe] FOREIGN KEY([IdEquipe])
REFERENCES [dbo].[Equipe] ([IdEquipe])
GO
ALTER TABLE [dbo].[Activite] CHECK CONSTRAINT [FK_Activite_ref_Equipe]
GO
ALTER TABLE [dbo].[Activite]  WITH CHECK ADD  CONSTRAINT [FK_Activite_ref_Machine] FOREIGN KEY([IdMachine])
REFERENCES [dbo].[Machine] ([IdMachine])
GO
ALTER TABLE [dbo].[Activite] CHECK CONSTRAINT [FK_Activite_ref_Machine]
GO
ALTER TABLE [dbo].[affiche]  WITH CHECK ADD  CONSTRAINT [FK_affiche_Reference_photo] FOREIGN KEY([photo_id])
REFERENCES [dbo].[photo] ([photo_id])
GO
ALTER TABLE [dbo].[affiche] CHECK CONSTRAINT [FK_affiche_Reference_photo]
GO
ALTER TABLE [dbo].[affiche]  WITH CHECK ADD  CONSTRAINT [FK_affiche_Reference_tr_catego] FOREIGN KEY([sup_id])
REFERENCES [dbo].[tr_categorie_support] ([sup_id])
GO
ALTER TABLE [dbo].[affiche] CHECK CONSTRAINT [FK_affiche_Reference_tr_catego]
GO
ALTER TABLE [dbo].[affiche]  WITH CHECK ADD  CONSTRAINT [FK_affiche_Reference_tr_platef] FOREIGN KEY([plt_id])
REFERENCES [dbo].[tr_plateforme] ([plt_id])
GO
ALTER TABLE [dbo].[affiche] CHECK CONSTRAINT [FK_affiche_Reference_tr_platef]
GO
ALTER TABLE [dbo].[asso_livraison_affiche]  WITH CHECK ADD  CONSTRAINT [FK_assoLivraisonAffiche_afficheinitiaLivraison] FOREIGN KEY([id_affiche_initial_livraison])
REFERENCES [dbo].[affiche] ([affiche_id])
GO
ALTER TABLE [dbo].[asso_livraison_affiche] CHECK CONSTRAINT [FK_assoLivraisonAffiche_afficheinitiaLivraison]
GO
ALTER TABLE [dbo].[asso_livraison_affiche]  WITH CHECK ADD  CONSTRAINT [FK_assoLivraisonAffiche_afficheLivraison] FOREIGN KEY([Id_affiche_livraison])
REFERENCES [dbo].[affiche] ([affiche_id])
GO
ALTER TABLE [dbo].[asso_livraison_affiche] CHECK CONSTRAINT [FK_assoLivraisonAffiche_afficheLivraison]
GO
ALTER TABLE [dbo].[asso_livraison_affiche]  WITH CHECK ADD  CONSTRAINT [FK_assoLivraisonAffiche_Livraison] FOREIGN KEY([Id_livraison])
REFERENCES [dbo].[livraison] ([Id])
GO
ALTER TABLE [dbo].[asso_livraison_affiche] CHECK CONSTRAINT [FK_assoLivraisonAffiche_Livraison]
GO
ALTER TABLE [dbo].[asso_livraison_photo]  WITH CHECK ADD  CONSTRAINT [FK_asso_livraison_photo_Livraison] FOREIGN KEY([livraison_Id])
REFERENCES [dbo].[livraison] ([Id])
GO
ALTER TABLE [dbo].[asso_livraison_photo] CHECK CONSTRAINT [FK_asso_livraison_photo_Livraison]
GO
ALTER TABLE [dbo].[asso_livraison_photo]  WITH CHECK ADD  CONSTRAINT [FK_asso_livraison_photo_photo] FOREIGN KEY([photo_id])
REFERENCES [dbo].[photo] ([photo_id])
GO
ALTER TABLE [dbo].[asso_livraison_photo] CHECK CONSTRAINT [FK_asso_livraison_photo_photo]
GO
ALTER TABLE [dbo].[ColisPreparationExterne]  WITH NOCHECK ADD  CONSTRAINT [FK_Colis_PreparationExterne] FOREIGN KEY([IdPreparationExterne])
REFERENCES [dbo].[PreparationExterne] ([IdPreparationExterne])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[ColisPreparationExterne] CHECK CONSTRAINT [FK_Colis_PreparationExterne]
GO
ALTER TABLE [dbo].[Equipe]  WITH CHECK ADD  CONSTRAINT [FK_Equipe_ref_plateforme] FOREIGN KEY([plt_Id])
REFERENCES [dbo].[tr_plateforme] ([plt_id])
GO
ALTER TABLE [dbo].[Equipe] CHECK CONSTRAINT [FK_Equipe_ref_plateforme]
GO
ALTER TABLE [dbo].[fusion_affiche]  WITH CHECK ADD  CONSTRAINT [FK_fusion_affiche_ref_affiche] FOREIGN KEY([id_affiche])
REFERENCES [dbo].[affiche] ([affiche_id])
GO
ALTER TABLE [dbo].[fusion_affiche] CHECK CONSTRAINT [FK_fusion_affiche_ref_affiche]
GO
ALTER TABLE [dbo].[fusion_affiche]  WITH CHECK ADD  CONSTRAINT [FK_fusion_affiche_ref_affiche_chapeau] FOREIGN KEY([id_affiche_chapeau])
REFERENCES [dbo].[affiche] ([affiche_id])
GO
ALTER TABLE [dbo].[fusion_affiche] CHECK CONSTRAINT [FK_fusion_affiche_ref_affiche_chapeau]
GO
ALTER TABLE [dbo].[histo_historique_entite]  WITH CHECK ADD  CONSTRAINT [FK_HistoriqueEntite_ActionApplicative] FOREIGN KEY([IdActionApplicative])
REFERENCES [dbo].[histo_action_applicative] ([IdActionApplicative])
GO
ALTER TABLE [dbo].[histo_historique_entite] CHECK CONSTRAINT [FK_HistoriqueEntite_ActionApplicative]
GO
ALTER TABLE [dbo].[histo_historique_entite]  WITH CHECK ADD  CONSTRAINT [FK_HistoriqueEntite_TypeEntite] FOREIGN KEY([IdTypeEntite])
REFERENCES [dbo].[tr_type_entite] ([IdTypeEntite])
GO
ALTER TABLE [dbo].[histo_historique_entite] CHECK CONSTRAINT [FK_HistoriqueEntite_TypeEntite]
GO
ALTER TABLE [dbo].[instruction_detail]  WITH CHECK ADD  CONSTRAINT [FK_INSTR_DT_REFERENCE_TYPE_PRE] FOREIGN KEY([tpr_id])
REFERENCES [dbo].[tr_type_preparation] ([tpr_id])
GO
ALTER TABLE [dbo].[instruction_detail] CHECK CONSTRAINT [FK_INSTR_DT_REFERENCE_TYPE_PRE]
GO
ALTER TABLE [dbo].[instruction_train]  WITH CHECK ADD  CONSTRAINT [FK_INSTRUCT_REFERENCE_TR_ATELI] FOREIGN KEY([ate_id])
REFERENCES [dbo].[tr_atelier] ([ate_id])
GO
ALTER TABLE [dbo].[instruction_train] CHECK CONSTRAINT [FK_INSTRUCT_REFERENCE_TR_ATELI]
GO
ALTER TABLE [dbo].[instruction_train]  WITH CHECK ADD  CONSTRAINT [FK_INSTRUCT_REFERENCE_TR_INSTR] FOREIGN KEY([tip_ins_code])
REFERENCES [dbo].[tr_instruction_plus] ([tip_ins_code])
GO
ALTER TABLE [dbo].[instruction_train] CHECK CONSTRAINT [FK_INSTRUCT_REFERENCE_TR_INSTR]
GO
ALTER TABLE [dbo].[instruction_train]  WITH CHECK ADD  CONSTRAINT [FK_INSTRUCT_REFERENCE_TR_STA] FOREIGN KEY([tsr_repart_code])
REFERENCES [dbo].[tr_statut_repart] ([tsr_repart_code])
GO
ALTER TABLE [dbo].[instruction_train] CHECK CONSTRAINT [FK_INSTRUCT_REFERENCE_TR_STA]
GO
ALTER TABLE [dbo].[instruction_train]  WITH CHECK ADD  CONSTRAINT [FK_INSTRUCT_REFERENCE_TR_STAT] FOREIGN KEY([rpc_statut])
REFERENCES [dbo].[tr_statut] ([rpc_statut])
GO
ALTER TABLE [dbo].[instruction_train] CHECK CONSTRAINT [FK_INSTRUCT_REFERENCE_TR_STAT]
GO
ALTER TABLE [dbo].[instruction_visuels]  WITH CHECK ADD  CONSTRAINT [FK_INSTRUCT_REFERE_INSTRUCT] FOREIGN KEY([instr_code])
REFERENCES [dbo].[instruction_train] ([instr_code])
GO
ALTER TABLE [dbo].[instruction_visuels] CHECK CONSTRAINT [FK_INSTRUCT_REFERE_INSTRUCT]
GO
ALTER TABLE [dbo].[instruction_visuels]  WITH CHECK ADD  CONSTRAINT [FK_INSTRUCT_REFERENCE_TR_CATEG] FOREIGN KEY([sup_id])
REFERENCES [dbo].[tr_categorie_support] ([sup_id])
GO
ALTER TABLE [dbo].[instruction_visuels] CHECK CONSTRAINT [FK_INSTRUCT_REFERENCE_TR_CATEG]
GO
ALTER TABLE [dbo].[instruction_visuels]  WITH CHECK ADD  CONSTRAINT [FK_INSTRUCT_REFERENCE_TR_STATU] FOREIGN KEY([rpc_statut])
REFERENCES [dbo].[tr_statut] ([rpc_statut])
GO
ALTER TABLE [dbo].[instruction_visuels] CHECK CONSTRAINT [FK_INSTRUCT_REFERENCE_TR_STATU]
GO
ALTER TABLE [dbo].[instruction_visuels]  WITH CHECK ADD  CONSTRAINT [FK_INSTRUCT_REFERENCE_TR_TYPE_] FOREIGN KEY([tpr_id])
REFERENCES [dbo].[tr_type_preparation] ([tpr_id])
GO
ALTER TABLE [dbo].[instruction_visuels] CHECK CONSTRAINT [FK_INSTRUCT_REFERENCE_TR_TYPE_]
GO
ALTER TABLE [dbo].[Machine]  WITH CHECK ADD  CONSTRAINT [FK_Machine_ref_plateforme] FOREIGN KEY([plt_Id])
REFERENCES [dbo].[tr_plateforme] ([plt_id])
GO
ALTER TABLE [dbo].[Machine] CHECK CONSTRAINT [FK_Machine_ref_plateforme]
GO
ALTER TABLE [dbo].[mouvement]  WITH CHECK ADD FOREIGN KEY([IdActivite])
REFERENCES [dbo].[Activite] ([IdActivite])
GO
ALTER TABLE [dbo].[mouvement]  WITH CHECK ADD FOREIGN KEY([livraison_id])
REFERENCES [dbo].[livraison] ([Id])
GO
ALTER TABLE [dbo].[mouvement]  WITH CHECK ADD  CONSTRAINT [FK_reception_ref_affiche] FOREIGN KEY([affiche_id])
REFERENCES [dbo].[affiche] ([affiche_id])
GO
ALTER TABLE [dbo].[mouvement] CHECK CONSTRAINT [FK_reception_ref_affiche]
GO
ALTER TABLE [dbo].[mouvement]  WITH CHECK ADD  CONSTRAINT [FK_reception_ref_affiche_initial] FOREIGN KEY([id_affiche_initial])
REFERENCES [dbo].[affiche] ([affiche_id])
GO
ALTER TABLE [dbo].[mouvement] CHECK CONSTRAINT [FK_reception_ref_affiche_initial]
GO
ALTER TABLE [dbo].[RessourcePreparationExterne]  WITH NOCHECK ADD  CONSTRAINT [FK_Ressource_PreparationExterne] FOREIGN KEY([IdPreparationExterne])
REFERENCES [dbo].[PreparationExterne] ([IdPreparationExterne])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[RessourcePreparationExterne] CHECK CONSTRAINT [FK_Ressource_PreparationExterne]
GO
ALTER TABLE [dbo].[tf_anomalies]  WITH CHECK ADD  CONSTRAINT [fk_tf_anoma_de_type_tr_type_] FOREIGN KEY([tan_id])
REFERENCES [dbo].[tr_type_anomalie] ([tan_id])
GO
ALTER TABLE [dbo].[tf_anomalies] CHECK CONSTRAINT [fk_tf_anoma_de_type_tr_type_]
GO
ALTER TABLE [dbo].[tf_colis]  WITH CHECK ADD  CONSTRAINT [FK_TF_COLIS_REFERENCE_TR_ATELI] FOREIGN KEY([ate_id])
REFERENCES [dbo].[tr_atelier] ([ate_id])
GO
ALTER TABLE [dbo].[tf_colis] CHECK CONSTRAINT [FK_TF_COLIS_REFERENCE_TR_ATELI]
GO
ALTER TABLE [dbo].[tf_colis]  WITH CHECK ADD  CONSTRAINT [FK_TF_COLIS_REFERENCE_TR_DEST_] FOREIGN KEY([adr_id])
REFERENCES [dbo].[tr_dest_adresse] ([adr_id])
GO
ALTER TABLE [dbo].[tf_colis] CHECK CONSTRAINT [FK_TF_COLIS_REFERENCE_TR_DEST_]
GO
ALTER TABLE [dbo].[tf_colis]  WITH CHECK ADD  CONSTRAINT [FK_TF_COLIS_REFERENCE_TR_DESTI] FOREIGN KEY([dest_id])
REFERENCES [dbo].[tr_destinataire] ([dest_id])
GO
ALTER TABLE [dbo].[tf_colis] CHECK CONSTRAINT [FK_TF_COLIS_REFERENCE_TR_DESTI]
GO
ALTER TABLE [dbo].[tf_colis]  WITH CHECK ADD  CONSTRAINT [FK_TF_COLIS_REFERENCE_TR_FORMA] FOREIGN KEY([fc_col_id])
REFERENCES [dbo].[tr_format_colis] ([fc_col_id])
GO
ALTER TABLE [dbo].[tf_colis] CHECK CONSTRAINT [FK_TF_COLIS_REFERENCE_TR_FORMA]
GO
ALTER TABLE [dbo].[tf_colis]  WITH CHECK ADD  CONSTRAINT [FK_TF_COLIS_REFERENCE_TR_STATU] FOREIGN KEY([rpc_statut])
REFERENCES [dbo].[tr_statut] ([rpc_statut])
GO
ALTER TABLE [dbo].[tf_colis] CHECK CONSTRAINT [FK_TF_COLIS_REFERENCE_TR_STATU]
GO
ALTER TABLE [dbo].[tf_colis]  WITH CHECK ADD  CONSTRAINT [FK_TF_COLIS_REFERENCE_TR_TRANS] FOREIGN KEY([tsp_id], [tarif_code])
REFERENCES [dbo].[tr_trans_tarif] ([tsp_id], [tarif_code])
GO
ALTER TABLE [dbo].[tf_colis] CHECK CONSTRAINT [FK_TF_COLIS_REFERENCE_TR_TRANS]
GO
ALTER TABLE [dbo].[tf_dossier_semaine_depart]  WITH CHECK ADD FOREIGN KEY([IdAffiche])
REFERENCES [dbo].[affiche] ([affiche_id])
GO
ALTER TABLE [dbo].[tf_face_train]  WITH CHECK ADD  CONSTRAINT [FK_ID_JOUR_DEPART_REFERENCE_TR_JOUR_DEPART] FOREIGN KEY([IdJourDepart])
REFERENCES [dbo].[tr_jour_depart] ([jour_depart_id])
GO
ALTER TABLE [dbo].[tf_face_train] CHECK CONSTRAINT [FK_ID_JOUR_DEPART_REFERENCE_TR_JOUR_DEPART]
GO
ALTER TABLE [dbo].[tf_face_train]  WITH CHECK ADD  CONSTRAINT [FK_TF_FACE__REFERENCE_TF_COLIS] FOREIGN KEY([colis_id])
REFERENCES [dbo].[tf_colis] ([colis_id])
GO
ALTER TABLE [dbo].[tf_face_train] CHECK CONSTRAINT [FK_TF_FACE__REFERENCE_TF_COLIS]
GO
ALTER TABLE [dbo].[tf_face_train]  WITH CHECK ADD  CONSTRAINT [FK_TF_FACE__REFERENCE_TR_ATELI] FOREIGN KEY([ate_id])
REFERENCES [dbo].[tr_atelier] ([ate_id])
GO
ALTER TABLE [dbo].[tf_face_train] CHECK CONSTRAINT [FK_TF_FACE__REFERENCE_TR_ATELI]
GO
ALTER TABLE [dbo].[tf_face_train]  WITH CHECK ADD  CONSTRAINT [FK_TF_FACE__REFERENCE_TR_CATEG] FOREIGN KEY([sup_id])
REFERENCES [dbo].[tr_categorie_support] ([sup_id])
GO
ALTER TABLE [dbo].[tf_face_train] CHECK CONSTRAINT [FK_TF_FACE__REFERENCE_TR_CATEG]
GO
ALTER TABLE [dbo].[tf_face_train]  WITH CHECK ADD  CONSTRAINT [FK_TF_FACE__REFERENCE_TR_DESTI] FOREIGN KEY([dest_id])
REFERENCES [dbo].[tr_destinataire] ([dest_id])
GO
ALTER TABLE [dbo].[tf_face_train] CHECK CONSTRAINT [FK_TF_FACE__REFERENCE_TR_DESTI]
GO
ALTER TABLE [dbo].[tf_face_train]  WITH CHECK ADD  CONSTRAINT [FK_TF_FACE__REFERENCE_TR_ROULE] FOREIGN KEY([rouleur_id])
REFERENCES [dbo].[tr_rouleur] ([rouleur_id])
GO
ALTER TABLE [dbo].[tf_face_train] CHECK CONSTRAINT [FK_TF_FACE__REFERENCE_TR_ROULE]
GO
ALTER TABLE [dbo].[tf_face_train]  WITH CHECK ADD  CONSTRAINT [FK_TF_FACE__REFERENCE_TR_STATU] FOREIGN KEY([rpc_statut])
REFERENCES [dbo].[tr_statut] ([rpc_statut])
GO
ALTER TABLE [dbo].[tf_face_train] CHECK CONSTRAINT [FK_TF_FACE__REFERENCE_TR_STATU]
GO
ALTER TABLE [dbo].[tf_face_train]  WITH CHECK ADD  CONSTRAINT [FK_TF_UM_REFERENCE_TR_DESTI] FOREIGN KEY([dest_id])
REFERENCES [dbo].[tr_destinataire] ([dest_id])
GO
ALTER TABLE [dbo].[tf_face_train] CHECK CONSTRAINT [FK_TF_UM_REFERENCE_TR_DESTI]
GO
ALTER TABLE [dbo].[tf_face_train]  WITH CHECK ADD  CONSTRAINT [FK_TR_ATE_D_REFERENCE_TR_DESTI] FOREIGN KEY([dest_id])
REFERENCES [dbo].[tr_destinataire] ([dest_id])
GO
ALTER TABLE [dbo].[tf_face_train] CHECK CONSTRAINT [FK_TR_ATE_D_REFERENCE_TR_DESTI]
GO
ALTER TABLE [dbo].[tf_prepa_affiche]  WITH CHECK ADD  CONSTRAINT [FK_tfPrepaAffiche_afficheLivraison] FOREIGN KEY([affiche_livraison_Id])
REFERENCES [dbo].[affiche] ([affiche_id])
GO
ALTER TABLE [dbo].[tf_prepa_affiche] CHECK CONSTRAINT [FK_tfPrepaAffiche_afficheLivraison]
GO
ALTER TABLE [dbo].[tf_prepa_affiche]  WITH CHECK ADD  CONSTRAINT [FK_tfPrepaAffiche_afficheLivraison_initial] FOREIGN KEY([affiche_livraison_initial_Id])
REFERENCES [dbo].[affiche] ([affiche_id])
GO
ALTER TABLE [dbo].[tf_prepa_affiche] CHECK CONSTRAINT [FK_tfPrepaAffiche_afficheLivraison_initial]
GO
ALTER TABLE [dbo].[tf_repart_calcul]  WITH CHECK ADD  CONSTRAINT [fk_tf_repar_a_expedie_tr_desti] FOREIGN KEY([des_id], [des_type], [des_type_adr])
REFERENCES [dbo].[tr_destination] ([des_id], [des_type], [des_type_adr])
GO
ALTER TABLE [dbo].[tf_repart_calcul] CHECK CONSTRAINT [fk_tf_repar_a_expedie_tr_desti]
GO
ALTER TABLE [dbo].[tf_repart_calcul]  WITH CHECK ADD  CONSTRAINT [fk_tf_repar_affecte_a_tr_ateli] FOREIGN KEY([ate_id])
REFERENCES [dbo].[tr_atelier] ([ate_id])
GO
ALTER TABLE [dbo].[tf_repart_calcul] CHECK CONSTRAINT [fk_tf_repar_affecte_a_tr_ateli]
GO
ALTER TABLE [dbo].[tf_repart_calcul]  WITH CHECK ADD  CONSTRAINT [fk_tf_repar_dans_le_c_tr_socie] FOREIGN KEY([soc_id])
REFERENCES [dbo].[tr_societe] ([soc_id])
GO
ALTER TABLE [dbo].[tf_repart_calcul] CHECK CONSTRAINT [fk_tf_repar_dans_le_c_tr_socie]
GO
ALTER TABLE [dbo].[tf_repart_calcul]  WITH CHECK ADD  CONSTRAINT [fk_tf_repar_de_format_tr_categ] FOREIGN KEY([sup_id])
REFERENCES [dbo].[tr_categorie_support] ([sup_id])
GO
ALTER TABLE [dbo].[tf_repart_calcul] CHECK CONSTRAINT [fk_tf_repar_de_format_tr_categ]
GO
ALTER TABLE [dbo].[tf_repart_calcul]  WITH CHECK ADD  CONSTRAINT [fk_tf_repar_de_type_p_tr_type_] FOREIGN KEY([tpr_id])
REFERENCES [dbo].[tr_type_preparation] ([tpr_id])
GO
ALTER TABLE [dbo].[tf_repart_calcul] CHECK CONSTRAINT [fk_tf_repar_de_type_p_tr_type_]
GO
ALTER TABLE [dbo].[tf_repart_calcul]  WITH CHECK ADD  CONSTRAINT [fk_tf_repar_prepare_p_tr_activ] FOREIGN KEY([act_id])
REFERENCES [dbo].[tr_activite] ([act_id])
GO
ALTER TABLE [dbo].[tf_repart_calcul] CHECK CONSTRAINT [fk_tf_repar_prepare_p_tr_activ]
GO
ALTER TABLE [dbo].[tf_repart_calcul]  WITH CHECK ADD  CONSTRAINT [FK_TF_REPAR_REFERENCE_TF_UM] FOREIGN KEY([UM_id])
REFERENCES [dbo].[tf_UM] ([UM_id])
GO
ALTER TABLE [dbo].[tf_repart_calcul] CHECK CONSTRAINT [FK_TF_REPAR_REFERENCE_TF_UM]
GO
ALTER TABLE [dbo].[tf_repart_calcul]  WITH CHECK ADD  CONSTRAINT [FK_TF_REPAR_REFERENCE_TR_DESTI] FOREIGN KEY([dest_id])
REFERENCES [dbo].[tr_destinataire] ([dest_id])
GO
ALTER TABLE [dbo].[tf_repart_calcul] CHECK CONSTRAINT [FK_TF_REPAR_REFERENCE_TR_DESTI]
GO
ALTER TABLE [dbo].[tf_repart_calcul]  WITH CHECK ADD  CONSTRAINT [FK_TF_REPAR_REFERENCE_TR_STATU] FOREIGN KEY([rpc_statut])
REFERENCES [dbo].[tr_statut] ([rpc_statut])
GO
ALTER TABLE [dbo].[tf_repart_calcul] CHECK CONSTRAINT [FK_TF_REPAR_REFERENCE_TR_STATU]
GO
ALTER TABLE [dbo].[tf_UM]  WITH CHECK ADD  CONSTRAINT [FK_TF_UM_REFERENCE_TR_ATELI] FOREIGN KEY([ate_id])
REFERENCES [dbo].[tr_atelier] ([ate_id])
GO
ALTER TABLE [dbo].[tf_UM] CHECK CONSTRAINT [FK_TF_UM_REFERENCE_TR_ATELI]
GO
ALTER TABLE [dbo].[tf_UM]  WITH CHECK ADD  CONSTRAINT [FK_TF_UM_REFERENCE_TR_CATEG] FOREIGN KEY([sup_id])
REFERENCES [dbo].[tr_categorie_support] ([sup_id])
GO
ALTER TABLE [dbo].[tf_UM] CHECK CONSTRAINT [FK_TF_UM_REFERENCE_TR_CATEG]
GO
ALTER TABLE [dbo].[tf_UM]  WITH CHECK ADD  CONSTRAINT [FK_TF_UM_REFERENCE_TR_STATU] FOREIGN KEY([rpc_statut])
REFERENCES [dbo].[tr_statut] ([rpc_statut])
GO
ALTER TABLE [dbo].[tf_UM] CHECK CONSTRAINT [FK_TF_UM_REFERENCE_TR_STATU]
GO
ALTER TABLE [dbo].[tf_UM]  WITH CHECK ADD  CONSTRAINT [FK_TF_UM_REFERENCE_TR_TYPE_] FOREIGN KEY([tpr_id])
REFERENCES [dbo].[tr_type_preparation] ([tpr_id])
GO
ALTER TABLE [dbo].[tf_UM] CHECK CONSTRAINT [FK_TF_UM_REFERENCE_TR_TYPE_]
GO
ALTER TABLE [dbo].[tf_UM_colis]  WITH CHECK ADD  CONSTRAINT [FK_TF_UM_CO_REFERENCE_TF_COLIS] FOREIGN KEY([colis_id])
REFERENCES [dbo].[tf_colis] ([colis_id])
GO
ALTER TABLE [dbo].[tf_UM_colis] CHECK CONSTRAINT [FK_TF_UM_CO_REFERENCE_TF_COLIS]
GO
ALTER TABLE [dbo].[tf_UM_colis]  WITH CHECK ADD  CONSTRAINT [FK_TF_UM_CO_REFERENCE_TF_UM] FOREIGN KEY([UM_id])
REFERENCES [dbo].[tf_UM] ([UM_id])
GO
ALTER TABLE [dbo].[tf_UM_colis] CHECK CONSTRAINT [FK_TF_UM_CO_REFERENCE_TF_UM]
GO
ALTER TABLE [dbo].[tr_adresseMail_plateforme]  WITH CHECK ADD  CONSTRAINT [FK_adresseMail_plateforme_ref_plateforme] FOREIGN KEY([plt_id])
REFERENCES [dbo].[tr_plateforme] ([plt_id])
GO
ALTER TABLE [dbo].[tr_adresseMail_plateforme] CHECK CONSTRAINT [FK_adresseMail_plateforme_ref_plateforme]
GO
ALTER TABLE [dbo].[tr_ate_dest_trans]  WITH CHECK ADD  CONSTRAINT [FK_TR_ATE_D_REFERENCE_TR_ATELI] FOREIGN KEY([ate_id])
REFERENCES [dbo].[tr_atelier] ([ate_id])
GO
ALTER TABLE [dbo].[tr_ate_dest_trans] CHECK CONSTRAINT [FK_TR_ATE_D_REFERENCE_TR_ATELI]
GO
ALTER TABLE [dbo].[tr_ate_dest_trans]  WITH CHECK ADD  CONSTRAINT [FK_TR_ATE_D_REFERENCE_TR_TRANS] FOREIGN KEY([tsp_id], [tarif_code])
REFERENCES [dbo].[tr_trans_tarif] ([tsp_id], [tarif_code])
GO
ALTER TABLE [dbo].[tr_ate_dest_trans] CHECK CONSTRAINT [FK_TR_ATE_D_REFERENCE_TR_TRANS]
GO
ALTER TABLE [dbo].[tr_atelier]  WITH CHECK ADD  CONSTRAINT [fk_tr_ateli_comporte_tr_plate] FOREIGN KEY([plt_id])
REFERENCES [dbo].[tr_plateforme] ([plt_id])
GO
ALTER TABLE [dbo].[tr_atelier] CHECK CONSTRAINT [fk_tr_ateli_comporte_tr_plate]
GO
ALTER TABLE [dbo].[tr_atelier_droit_prepa]  WITH CHECK ADD  CONSTRAINT [fk_tr_ateli_droit_Surface] FOREIGN KEY([IdSurface])
REFERENCES [dbo].[Surface] ([IdSurface])
GO
ALTER TABLE [dbo].[tr_atelier_droit_prepa] CHECK CONSTRAINT [fk_tr_ateli_droit_Surface]
GO
ALTER TABLE [dbo].[tr_atelier_droit_prepa]  WITH CHECK ADD  CONSTRAINT [fk_tr_ateli_droit_tr_atelier] FOREIGN KEY([ate_id])
REFERENCES [dbo].[tr_atelier] ([ate_id])
GO
ALTER TABLE [dbo].[tr_atelier_droit_prepa] CHECK CONSTRAINT [fk_tr_ateli_droit_tr_atelier]
GO
ALTER TABLE [dbo].[tr_atelier_droit_prepa]  WITH CHECK ADD  CONSTRAINT [fk_tr_ateli_droit_tr_type_p] FOREIGN KEY([tpr_id])
REFERENCES [dbo].[tr_type_preparation] ([tpr_id])
GO
ALTER TABLE [dbo].[tr_atelier_droit_prepa] CHECK CONSTRAINT [fk_tr_ateli_droit_tr_type_p]
GO
ALTER TABLE [dbo].[tr_atelier_imprimante]  WITH CHECK ADD FOREIGN KEY([IdPlatforme])
REFERENCES [dbo].[tr_plateforme] ([plt_id])
GO
ALTER TABLE [dbo].[tr_atelier_support]  WITH CHECK ADD  CONSTRAINT [fk_tr_ateli_gere_tr_ateli] FOREIGN KEY([ate_id])
REFERENCES [dbo].[tr_atelier] ([ate_id])
GO
ALTER TABLE [dbo].[tr_atelier_support] CHECK CONSTRAINT [fk_tr_ateli_gere_tr_ateli]
GO
ALTER TABLE [dbo].[tr_atelier_support]  WITH CHECK ADD  CONSTRAINT [fk_tr_ateli_prepare_p_tr_categ] FOREIGN KEY([sup_id])
REFERENCES [dbo].[tr_categorie_support] ([sup_id])
GO
ALTER TABLE [dbo].[tr_atelier_support] CHECK CONSTRAINT [fk_tr_ateli_prepare_p_tr_categ]
GO
ALTER TABLE [dbo].[tr_dest_adresse]  WITH CHECK ADD  CONSTRAINT [FK_TR_DEST__REFERENCE_TR_COMMU] FOREIGN KEY([calb_id])
REFERENCES [dbo].[tr_communes_calber] ([calb_id])
GO
ALTER TABLE [dbo].[tr_dest_adresse] CHECK CONSTRAINT [FK_TR_DEST__REFERENCE_TR_COMMU]
GO
ALTER TABLE [dbo].[tr_dest_adresse]  WITH CHECK ADD  CONSTRAINT [FK_TR_DEST__REFERENCE_TR_TYPE_] FOREIGN KEY([tad_cod])
REFERENCES [dbo].[tr_type_adresse] ([tad_cod])
GO
ALTER TABLE [dbo].[tr_dest_adresse] CHECK CONSTRAINT [FK_TR_DEST__REFERENCE_TR_TYPE_]
GO
ALTER TABLE [dbo].[tr_poste]  WITH CHECK ADD  CONSTRAINT [FK_TR_POSTE_REFERENCE_TR_ATELI] FOREIGN KEY([ate_id])
REFERENCES [dbo].[tr_atelier] ([ate_id])
GO
ALTER TABLE [dbo].[tr_poste] CHECK CONSTRAINT [FK_TR_POSTE_REFERENCE_TR_ATELI]
GO
ALTER TABLE [dbo].[tr_poste]  WITH CHECK ADD  CONSTRAINT [FK_TR_POSTE_REFERENCE_TR_PLATE] FOREIGN KEY([plt_id])
REFERENCES [dbo].[tr_plateforme] ([plt_id])
GO
ALTER TABLE [dbo].[tr_poste] CHECK CONSTRAINT [FK_TR_POSTE_REFERENCE_TR_PLATE]
GO
ALTER TABLE [dbo].[tr_rouleur]  WITH CHECK ADD  CONSTRAINT [FK_TR_ROULE_REFERENCE_TR_ATELI] FOREIGN KEY([ate_id])
REFERENCES [dbo].[tr_atelier] ([ate_id])
GO
ALTER TABLE [dbo].[tr_rouleur] CHECK CONSTRAINT [FK_TR_ROULE_REFERENCE_TR_ATELI]
GO
ALTER TABLE [dbo].[tr_trans_tarif]  WITH CHECK ADD  CONSTRAINT [FK_TR_TRANS_REFERENCE_TR_TRANS] FOREIGN KEY([tsp_id])
REFERENCES [dbo].[tr_transporteur] ([tsp_id])
GO
ALTER TABLE [dbo].[tr_trans_tarif] CHECK CONSTRAINT [FK_TR_TRANS_REFERENCE_TR_TRANS]
GO
ALTER TABLE [dbo].[tr_transporteur_atelier]  WITH CHECK ADD  CONSTRAINT [fk_tr_trans_ate_tr_transporteur] FOREIGN KEY([tsp_id])
REFERENCES [dbo].[tr_transporteur] ([tsp_id])
GO
ALTER TABLE [dbo].[tr_transporteur_atelier] CHECK CONSTRAINT [fk_tr_trans_ate_tr_transporteur]
GO
ALTER TABLE [dbo].[tr_transporteur_atelier]  WITH CHECK ADD  CONSTRAINT [FK_TR_TRANS_REFERENCE_TR_ATELI] FOREIGN KEY([ate_id])
REFERENCES [dbo].[tr_atelier] ([ate_id])
GO
ALTER TABLE [dbo].[tr_transporteur_atelier] CHECK CONSTRAINT [FK_TR_TRANS_REFERENCE_TR_ATELI]
GO
ALTER TABLE [dbo].[tr_typ_aff_amt]  WITH CHECK ADD  CONSTRAINT [fk_tr_typ_a_interface_tr_type_] FOREIGN KEY([tpr_id])
REFERENCES [dbo].[tr_type_preparation] ([tpr_id])
GO
ALTER TABLE [dbo].[tr_typ_aff_amt] CHECK CONSTRAINT [fk_tr_typ_a_interface_tr_type_]
GO
ALTER TABLE [dbo].[tr_utilisateur]  WITH CHECK ADD  CONSTRAINT [fk_tr_utilisateur_tr_atelier] FOREIGN KEY([ate_id])
REFERENCES [dbo].[tr_atelier] ([ate_id])
GO
ALTER TABLE [dbo].[tr_utilisateur] CHECK CONSTRAINT [fk_tr_utilisateur_tr_atelier]
GO
ALTER TABLE [dbo].[tr_utilisateur]  WITH CHECK ADD  CONSTRAINT [fk_utilisateur_profil] FOREIGN KEY([prf_id])
REFERENCES [dbo].[tr_profil] ([prf_id])
GO
ALTER TABLE [dbo].[tr_utilisateur] CHECK CONSTRAINT [fk_utilisateur_profil]
GO
ALTER TABLE [dbo].[tr_utilisateur_data]  WITH CHECK ADD  CONSTRAINT [FK_TR_UTILI_REFERENCE_TR_ATELI] FOREIGN KEY([ate_id])
REFERENCES [dbo].[tr_atelier] ([ate_id])
GO
ALTER TABLE [dbo].[tr_utilisateur_data] CHECK CONSTRAINT [FK_TR_UTILI_REFERENCE_TR_ATELI]
GO
ALTER TABLE [dbo].[tr_utilisateur_data]  WITH CHECK ADD  CONSTRAINT [FK_TR_UTILI_REFERENCE_TR_PLATE] FOREIGN KEY([plt_id])
REFERENCES [dbo].[tr_plateforme] ([plt_id])
GO
ALTER TABLE [dbo].[tr_utilisateur_data] CHECK CONSTRAINT [FK_TR_UTILI_REFERENCE_TR_PLATE]
GO
ALTER TABLE [dbo].[TypePreparation]  WITH CHECK ADD  CONSTRAINT [fk_TypePrepa_tr_type_prepa] FOREIGN KEY([tpr_id])
REFERENCES [dbo].[tr_type_preparation] ([tpr_id])
GO
ALTER TABLE [dbo].[TypePreparation] CHECK CONSTRAINT [fk_TypePrepa_tr_type_prepa]
GO
/****** Object:  StoredProcedure [dbo].[insertTravAdresseLivraisonAfficheur]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[insertTravAdresseLivraisonAfficheur]
(
	@adresses adresseLivraisonAfficheurTableType readonly
)
AS
begin
	--  description : proc d'alimentation de la table de travail 
	--				des adresses de livraison des afficheurs
	--
	-- 2017-03-01	| Wheeler A.	| creation
	-- 2017-06-14	| SAMMARI M.	| Ajout de colonnes (CodePex,Mail,NmTel
    
	-- on purge les données precedentes
	delete from trav_adresseLivraisonAfficheur

	-- puis on insert les données
	insert trav_adresseLivraisonAfficheur (IdRessource, DateDebutPivot, DateFinPivot, IdAdresse, Destinataire, 
		PointDeRemise, NumeroDeVoie, TypeDeVoie, LibelleVoie, LieuDit, CodePostal, Commune, Cedex, IdTypeDestinationDA,
		IdTiers, IdDepot, IdSiteCCF,des_Mail,des_NumTel)
	select distinct IdRessource, DateDebutPivot, DateFinPivot, IdAdresse, Destinataire, 
		PointDeRemise, NumeroDeVoie, TypeDeVoie, LibelleVoie, LieuDit, CodePostal, Commune, Cedex, IdTypeDestinationDA,
		IdTiers, IdDepot, IdSiteCCF,Mail,max(NumTel)
	from @adresses
	group by IdRessource, DateDebutPivot, DateFinPivot, IdAdresse, Destinataire, 
		PointDeRemise, NumeroDeVoie, TypeDeVoie, LibelleVoie, LieuDit, CodePostal, Commune, Cedex, IdTypeDestinationDA,
		IdTiers, IdDepot, IdSiteCCF,Mail

	return 0
end
;

GO
/****** Object:  StoredProcedure [dbo].[insertTravGroupePreparation]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[insertTravGroupePreparation]
(
	@groupePrepas groupePreparationTableType readonly
)
AS
begin
	--  description : proc d'alimentation de la table de travail 
	--				des groupes de preparation
	--
	-- 2017-03-01	| Wheeler A.	| creation

	-- on purge les données precedentes
	delete from trav_groupePreparation

	-- puis on insert les données
	insert trav_groupePreparation(IdGroupePreparation, IdReferentielStatut, IdTypePreparation, IdFormat, 
		IdSiteCCF, Entretien, Semaine, AnneeSemaine, QuiCreation, DateCreation, QuiModification, DateModification, ReferenceMigration, rpc_statut)
	select IdGroupePreparation, IdReferentielStatut, IdTypePreparation, IdFormat, 
		IdSiteCCF, Entretien, Semaine, AnneeSemaine, QuiCreation, DateCreation, QuiModification, DateModification, ReferenceMigration, 0 -- a traiter
	from @groupePrepas

	return 0
end
;
GO
/****** Object:  StoredProcedure [dbo].[insertTravInstruction]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[insertTravInstruction]
(
	@instructions trainInstructionTableType readonly
)
AS
begin
	--  description : proc d'alimentation de la table de travail 
	--				pour la preparation des scros
	--
	-- 2017-04-25	| Wheeler A.	| creation

	-- on purge les données precedentes
	delete from tra_amt_log_instruction

	-- puis on insert les données
	insert tra_amt_log_instruction (Id, type_instruction, rese_ident, cont_num, nom, date_ligne, afch_ident,
		theme, sect_code_centre, pourcentage, form_larg, form_haut, tyaf_code, typr_code, cont_anbas,
		cont_sembas, talr_trait,Commentaire)
	select Id, type_instruction, rese_ident, cont_num, nom, date_ligne, afch_ident,
		theme, sect_code_centre, pourcentage, form_larg, form_haut, tyaf_code, typr_code, cont_anbas,
		cont_sembas, talr_trait,Commentaire
	from @instructions

	return 0
end
;
GO
/****** Object:  StoredProcedure [dbo].[insertTravInstructionDetail]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[insertTravInstructionDetail]
(
	@instructionDetail trainInstructionDetailTableType readonly
)
AS
begin
	--  description : proc d'alimentation de la table de travail 
	--				de preparation pour les scro
	--
	-- 2017.04.25	| Wheeler A.	| creation
	-- 2017.05.11	| Wheeler A.	| 

	-- puis on insert les données
	insert tra_amt_log_instruc_det (Id, origine, cont_num, cadr_ident, cdep_datdep, date_ligne, 
		sect_code, valeur, rese_ident, depa_code, aggl_numord, afch_ident, theme, sect_code_centre, 
		form_larg, form_haut, tyaf_code, talr_trait, type_instruction, cont_anbas, cont_sembas, cadre_lib,
		IdFaceOTAffichage, IdTypePreparation)
	select Id, origine, cont_num, cadr_ident, cdep_datdep, date_ligne, 
		sect_code, valeur, rese_ident, depa_code, aggl_numord, afch_ident, theme, sect_code_centre, 
		form_larg, form_haut, tyaf_code, talr_trait, type_instruction, cont_anbas, cont_sembas, cadre_lib,
		IdFaceOTAffichage, IdTypePreparation
	from @instructionDetail

	return 0
end
;
GO
/****** Object:  StoredProcedure [dbo].[insertTravPreparation]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[insertTravPreparation]
(
	@preparations preparationTableType readonly
)
AS
begin
	--  description : proc d'alimentation de la table de travail 
	--				de preparation pour le 2m² fixe et le pliage
	--
	-- 2017-03-23	| Wheeler A.	| creation

	-- on purge les données precedentes
	delete from trav_preparation

	-- puis on insert les données
	insert trav_preparation(IdPreparationChapeau, IdGroupePreparation, IdPreparationDetail, IdDossierDeVenteChapeau, DatePremierDepart, 
		Annonceur, IdTheme, Theme, IdThemeBandeau, ThemeBandeau, IdTypePreparation, IdFormat, IdSurface, IdSiteCCF, Semaine, AnneeSemaine, 
		Quantite, QuantiteEntretien, IdRessource, Nom, Prenom, IdTypeDestinationDA, IdDestinataire, IdAdresse, rpc_statut,IdReferentielStatutPreparation)
	select IdPreparationChapeau, IdGroupePreparation, IdPreparationDetail, IdDossierDeVenteChapeau, DatePremierDepart, 
		Annonceur, IdTheme, Theme, IdThemeBandeau, ThemeBandeau, IdTypePreparation, IdFormat, IdSurface, IdSiteCCF, Semaine, AnneeSemaine, 
		Quantite, QuantiteEntretien, IdRessource, Nom, Prenom, IdTypeDestinationDA, IdDestinataire, IdAdresse, 0, IdReferentielStatut	-- a traiter
	from @preparations

	return 0
end
;

GO
/****** Object:  StoredProcedure [dbo].[insertTravPreparationDetail]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[insertTravPreparationDetail]
(
	@prepaDetails preparationDetailTableType readonly
)
AS
begin
	--  description : proc d'alimentation de la table de travail 
	--				des lignes de preparations details
	--
	-- 2017-03-01	| Wheeler A.	| creation

	-- on purge les données precedentes
	delete from trav_preparationDetail

	-- puis on insert les données
	insert trav_preparationDetail(IdPreparationDetail, IdGroupePreparation, IdAdresse, IdTypeDestinationDA, IdTheme, 
		IdThemeBandeau, IdThemeFlap, Quantite, QuantiteEntretien, Destinataire, IdRessource, Afficheur, QuiCreation, DateCreation, 
		QuiModification, DateModification, ReferenceMigration)
	select IdPreparationDetail, IdGroupePreparation, IdAdresse, IdTypeDestinationDA, IdTheme, 
		IdThemeBandeau, IdThemeFlap, Quantite, QuantiteEntretien, Destinataire, IdRessource, Afficheur, QuiCreation, DateCreation, 
		QuiModification, DateModification, ReferenceMigration
	from @prepaDetails

	return 0
end
;
GO
/****** Object:  StoredProcedure [dbo].[insertTravTheme]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[insertTravTheme]
(
	@themes themeTableType readonly
)
AS
begin
	--  description : proc d'alimentation de la table de travail 
	--				des themes
	--
	-- 2017-03-20	| Wheeler A.	| creation

	-- on purge les données precedentes
	delete from trav_theme

	-- puis on insert les données
	insert trav_theme(IdTheme, IdInstructionChapeau, IdTypeTheme, Description, Photo,  
		QuiCreation, DateCreation, QuiModification, DateModification, ReferenceMigration)
	select IdTheme, IdInstructionChapeau, IdTypeTheme, Description, Photo,  
		QuiCreation, DateCreation, QuiModification, DateModification, ReferenceMigration
	from @themes

	return 0
end
;
GO
/****** Object:  StoredProcedure [dbo].[insertTravTrainAffiche]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[insertTravTrainAffiche]
(
	@trainAffiches trainAfficheTableType readonly
)
AS
begin
	--  description : proc d'alimentation de la table de travail 
	--				des trains d'affiches
	--
	-- 2017.04.20	| Wheeler A.	| creation
	-- 2017.05.11	| Wheeler A.	| tfs extplay 27928 : on ne purge plus dans cette proc en raison 
	--				|				| de la volumetire des trains d'affiches
	--2017.06.19	|SAMMARI M.		| Ajout des colonnes Conservation,RegionCCF,CoteCote

	-- puis on insert les données
	insert trav_trainAffiche (Id, IdFaceOTAffichage, IdFace, RefFace, IdFormat, IdSurface, DateDepart, IdLocalisation, 
		IdStructure, IdPanel, IdRessource, Nom, Prenom, EstInterne, IdUniversContractuel, 
		IdTypePreparation, AnneeSemaine, Semaine, IdDossierDeVenteChapeau, IdAnnonceur, 
		AnnonceurLibelle, IdTypeDestinationDA, IdDestinataire, IdAdresseDestinataire, 
		IdAdressePat, IdTypeVoie, TypeVoieLibelle, IdCommune, CommuneNom, NumeroDeVoie,
		Voie, BoitePostale, LieuDit, CodePostalLibre, Localite, IdPDVFace, IdEspace, 
		EspaceNom, NumeroOrdre, PositionTrainOrigine, PositionTrainModifie,	IdSiteCCF, Traitement,Conservation,RegionCCF,CoteCote)
	select Id, IdFaceOTAffichage, IdFace, RefFace, IdFormat, IdSurface, DateDepart, IdLocalisation, 
		IdStructure, IdPanel, IdRessource, Nom, Prenom, EstInterne, IdUniversContractuel, 
		IdTypePreparation, AnneeSemaine, Semaine, IdDossierDeVenteChapeau, IdAnnonceur, 
		AnnonceurLibelle, IdTypeDestinationDA, IdDestinataire, IdAdresseDestinataire, 
		IdAdressePat, IdTypeVoie, TypeVoieLibelle, IdCommune, CommuneNom, NumeroDeVoie,
		Voie, BoitePostale, LieuDit, CodePostalLibre, Localite, IdPDVFace, IdEspace, 
		EspaceNom, NumeroOrdre, PositionTrainOrigine, PositionTrainModifie,	IdSiteCCF, Traitement, Conservation,RegionCCF,CoteCote
	from @trainAffiches

	return 0
end
;
GO
/****** Object:  StoredProcedure [dbo].[p_Alimentation_tf_prepa_affiche]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[p_Alimentation_tf_prepa_affiche]
AS
BEGIN


-- =============================================
-- Author:		Jerbi Omar
-- Create date: 08/09/2017
-- Description:	tf_prepa_affiche table Alimentation
-- =============================================

declare @error int
declare @week  int
declare @year  int
Declare @maxWeekPerYear int
Declare @now as dateTime =getdate()

	 -- SET NOCOUNT ON added to prevent extra result sets from
	 -- interfering with SELECT statements.
	 SET NOCOUNT ON;

	 SELECT @week = DATEPART( wk, @now)
     SELECT @year = DATEPART( YEAR, @now)
	 SELECT @maxWeekPerYear = DATEPART( wk, DATEADD(yy, DATEDIFF(yy, 0, @now) + 1, -1))
	

	 CREATE table #prepa_affiche_recu(
	  plt_id int null,
	  cont_num int null,
      rpc_annonceur varchar(100) null,  
      rpc_theme varchar(50) null,
      sem_num int null,
	  sem_annee int null,
	  FromBroadcast bit null,
	  sup_id int null,
	  ate_id int null
	 )
	 
	 CREATE table #bandeau (
	sup_id int null,
	theme varchar(50) null,
	dossier int null,
	quantite int null,
	semaine int null,
	annee int null,
	plt_id int null,
	annonceur varchar(50) null,
	ate_id int null,
	)

	CREATE table #temp(
	repiquage  varchar(50) null
	,cont_num int null
	,quantite int null
	,sem_num int null
	,sem_annee int null
	,plt_id int null
	,sup_id int null
	,rpc_annonceur varchar(50) null
	,ate_id int null)

	CREATE table #travail(
	[plt_id] [int] NULL,
	[sup_id] [int] NULL,
	[cont_num] [int] NULL,
	[Format] [varchar](50) NULL,
	[rpc_annonceur] [varchar](100) NULL,
	[rpc_num_aff_amt] [int] NULL,
	[rpc_theme] [varchar](50) NULL,
	[Qte_Theorique] [int] NULL,
	[sem_num] [int] NULL,
	[sem_annee] [int] NULL,
	[FromBroadcast] [bit] NULL,
	[dateCreated] [datetime] NULL,
	[dateModified] [datetime] NULL,
	[repiquage] [varchar](50) NULL,
	[IdDAChapeau] [int] NULL,
	[ate_id] [smallint] NULL,
	)
	
	declare @inserted table ([id] int)

	
	 if((@week + 8) <= @maxWeekPerYear)
	  Begin

	  insert into #prepa_affiche_recu ( plt_id,cont_num,rpc_annonceur,rpc_theme, sem_num,sem_annee,FromBroadcast,sup_id,ate_id)
	   SELECT plt_id,cont_num,rpc_annonceur,rpc_theme,sem_num,sem_annee,FromBroadcast,sup_id,ate_id
        from tf_prepa_affiche
	     where sem_num between (@week)
		  and (@week + 8) 
		  and sem_annee = @year

	  End
	  else
	   Begin

	   insert into #prepa_affiche_recu ( plt_id,cont_num,rpc_annonceur,rpc_theme, sem_num,sem_annee,FromBroadcast,sup_id,ate_id)
	   SELECT plt_id,cont_num,rpc_annonceur,rpc_theme,sem_num,sem_annee,FromBroadcast,sup_id,ate_id
        from tf_prepa_affiche
	     where (sem_num between (@week) and (@maxWeekPerYear) and sem_annee = @year)
		     or (sem_num between 1 and (1+ (8-(@maxWeekPerYear - @week))) and sem_annee = (@year + 1))

	   End
	

 --     -- get data from tf_prepa_Broadcast

	  CREATE table #temp_tf_prepa_Broadcast(
	  plt_id int null,
	  plt_nom varchar(50) null,
	  sup_id int null,
	  cont_num int null,
	  Surface varchar(50) null,
	  rpc_annonceur varchar(100) null,
	  rpc_num_aff_amt int null,
	  rpc_theme varchar(100) null,
	  Qte_Theorique int null,
	  sem_num int null,
	  sem_annee int null,
	  repiquage varchar(50) null,
	  IdDAChapeau int null
	  )

	  insert into #temp_tf_prepa_Broadcast (plt_id ,plt_nom ,sup_id ,cont_num ,Surface ,rpc_annonceur ,rpc_num_aff_amt ,rpc_theme ,Qte_Theorique ,sem_num ,sem_annee,repiquage,IdDAChapeau)
	   select null, DestinataireEffectif,cs.sup_id,IdDossierDeVenteChapeau,cs.sup_nom,Annonceur,null,Theme,quantite,sem_num,sem_annee,repiquage,IdDAChapeau
	     from tf_prepa_Broadcast pb 
		  JOIN tr_categorie_support cs on pb.sup_id = cs.sup_id
	 where (StatutPreparation != 'Envoyé' or StatutPreparation is null )and DestinataireEffectif not in ('Plateforme Derichebourg Lyon','Plateforme Derichebourg')


	  -- on r�cupere la plateforme id
	update #temp_tf_prepa_Broadcast
	set plt_id = (select tp.plt_id from tr_plateforme tp where UPPER(tpb.plt_nom) LIKE '%' + UPPER(tp.plt_nom) + '%')
	from #temp_tf_prepa_Broadcast tpb


-- on cr�e une table pour r�cup�rer les cont_num d�ja recu 
CREATE table #List_Cont_num_Received(
  cont_num int null,
  sup_id int null,
  plt_id int null,
  sem_num int,
  theme nvarchar(100)
)

-- on ins�re les cont_num recu dans la table 
insert into #List_Cont_num_Received ( cont_num,sup_id,plt_id,sem_num,theme) (select cont_num,sup_id,plt_id,sem_num,rpc_theme from tf_prepa_affiche where ARecevoir = 1)

	BEGIN TRAN 

	 if((@week + 8) <= @maxWeekPerYear)
	  Begin

  --   INSERT INTO CIRCE.dbo.tf_prepa_affiche
	 INSERT INTO #travail
      (plt_id,sup_id,cont_num,[Format],rpc_annonceur,rpc_num_aff_amt,rpc_theme,Qte_Theorique,sem_num,sem_annee,FromBroadcast,dateCreated,dateModified,repiquage,IdDAChapeau,ate_id)
	--  output inserted.Id
	  --into @inserted
     select distinct plt_id,tr.sup_id,cont_num,sup_nom,rpc_annonceur,rpc_num_aff_amt,rpc_theme,sum(rpc_qte) as rpc_qte,sem_num,sem_annee,null,GETDATE(),null,tr.rpc_repiquage, null,tr.ate_id
      from tf_repart_calcul tr
       join tr_atelier  ta on tr.ate_id = ta.ate_id
       join tr_categorie_support tcs on tr.sup_id = tcs.sup_id
        where rpc_statut <> 4 and sem_num between (@week) and (@week + 8) and sem_annee = @year 
           and not EXISTS (select * from #prepa_affiche_recu where tr.cont_num= cont_num and tr.rpc_annonceur=rpc_annonceur and plt_id = ta.plt_id and sem_annee = tr.sem_annee and sup_id = tr.sup_id
		   and sem_num = tr.sem_num and (rpc_theme = tr.rpc_theme))  --and (FromBroadcast = 0 or FromBroadcast is null))
		  group by plt_id,tr.sup_id,cont_num,sup_nom,rpc_annonceur,rpc_num_aff_amt,rpc_theme,sem_num,sem_annee,rpc_repiquage,tr.ate_id

      UNION

    select distinct plt_id, tr.sup_id,cont_num,sup_nom,cont_annonc,theme_id,theme,count(ft_id) as rpc_qte,dep_sembas, dep_anbas,null,GETDATE(),null,tr.repiquage,null,tr.ate_id
     from tf_face_train tr
      join tr_atelier  ta on tr.ate_id = ta.ate_id
      join tr_categorie_support tcs on tr.sup_id = tcs.sup_id
       where rpc_statut <> 4 and dep_sembas between (@week) and (@week + 8) and dep_anbas = @year and theme is not null
        	 --and cont_num = 461837
        and not EXISTS (select cont_num from #prepa_affiche_recu where cont_num = tr.cont_num and rpc_annonceur = tr.cont_annonc and plt_id =ta.plt_id and sem_annee = tr.cont_anbas and sup_id = tr.sup_id
		and sem_num = tr.cont_sembas and (rpc_theme = theme)) --and (FromBroadcast = 0 or FromBroadcast is null)) 
         group by plt_id, tr.sup_id,cont_num,sup_nom,cont_annonc,theme_id,theme,dep_sembas, dep_anbas,repiquage ,tr.ate_id

       UNION

	   select distinct plt_id  ,sup_id ,cont_num ,Surface ,rpc_annonceur ,rpc_num_aff_amt ,rpc_theme ,sum(Qte_Theorique) as Qte_Theorique ,sem_num ,sem_annee,1,GETDATE(),null,repiquage,IdDAChapeau,null
	    from #temp_tf_prepa_Broadcast tempBC
		 where sem_num between (@week) and (@week + 8) and sem_annee = @year 
		 and not EXISTS (select cont_num from #prepa_affiche_recu where cont_num = tempBC.cont_num and sup_id = tempBC.sup_id and FromBroadcast = 1 and sem_num = tempBC.sem_num and plt_id = tempBC.plt_id) 
		  group by plt_id ,sup_id ,cont_num ,Surface ,rpc_annonceur ,rpc_num_aff_amt ,rpc_theme ,Qte_Theorique,sem_num,sem_annee,repiquage,IdDAChapeau
      
	  End
	 else
	  Begin 

	 INSERT INTO #travail
	   -- INSERT INTO CIRCE.dbo.tf_prepa_affiche
      (plt_id,sup_id,cont_num,[Format],rpc_annonceur,rpc_num_aff_amt,rpc_theme,Qte_Theorique,sem_num,sem_annee,FromBroadcast,dateCreated,dateModified,repiquage,IdDAChapeau,ate_id)
	   --output inserted.Id
	   --into @inserted
     select distinct plt_id,tr.sup_id,cont_num,sup_nom,rpc_annonceur,rpc_num_aff_amt,rpc_theme,sum(rpc_qte) as rpc_qte,sem_num,sem_annee,null,GETDATE(),null,tr.rpc_repiquage,null,tr.ate_id
      from tf_repart_calcul tr
       join tr_atelier  ta on tr.ate_id = ta.ate_id
       join tr_categorie_support tcs on tr.sup_id = tcs.sup_id
        where rpc_statut <> 4 and (
		                         (sem_num between (@week) and (@maxWeekPerYear) and sem_annee = @year)
		                      or (sem_num between 1 and (1+ (8-(@maxWeekPerYear - @week))) and sem_annee = (@year + 1))
							      )
        and not EXISTS (select * from #prepa_affiche_recu where tr.cont_num= cont_num and tr.rpc_annonceur=rpc_annonceur and plt_id = ta.plt_id and sem_annee = tr.sem_annee and sup_id = tr.sup_id
		   and sem_num = tr.sem_num and (rpc_theme = tr.rpc_theme))  --and (FromBroadcast = 0 or FromBroadcast is null))
		  group by plt_id,tr.sup_id,cont_num,sup_nom,rpc_annonceur,rpc_num_aff_amt,rpc_theme,sem_num,sem_annee,rpc_repiquage,tr.ate_id

      UNION

    select distinct plt_id, tr.sup_id,cont_num,sup_nom,cont_annonc,theme_id,theme,count(ft_id) as rpc_qte,dep_sembas, dep_anbas,null,GETDATE(),null,tr.repiquage,null, tr.ate_id
     from tf_face_train tr
      join tr_atelier  ta on tr.ate_id = ta.ate_id
      join tr_categorie_support tcs on tr.sup_id = tcs.sup_id
       where rpc_statut <> 4 and (
	            (dep_sembas between (@week) and (@maxWeekPerYear) and dep_anbas = @year)
		     or (dep_sembas between 1 and (1+ (8-(@maxWeekPerYear - @week))) and dep_anbas = (@year + 1)) 
			                     )
			 and theme is not null
         and not EXISTS (select cont_num from #prepa_affiche_recu where cont_num = tr.cont_num and rpc_annonceur = tr.cont_annonc and plt_id =ta.plt_id and sem_annee = tr.cont_anbas and sup_id = tr.sup_id
		and sem_num = tr.cont_sembas and (rpc_theme = theme )) --and (FromBroadcast = 0 or FromBroadcast is null)) 
         group by plt_id, tr.sup_id,cont_num,sup_nom,cont_annonc,theme_id,theme,dep_sembas, dep_anbas,repiquage ,tr.ate_id

       UNION

	   select distinct plt_id  ,sup_id ,cont_num ,Surface ,rpc_annonceur ,rpc_num_aff_amt ,rpc_theme ,sum(Qte_Theorique) as Qte_Theorique ,sem_num ,sem_annee,1,GETDATE(),null,repiquage,IdDAChapeau, null
	    from #temp_tf_prepa_Broadcast tempBC
		 where (
		        (sem_num between (@week) and (@maxWeekPerYear) and sem_annee = @year)
		     or (sem_num between 1 and (1+ (8-(@maxWeekPerYear - @week))) and sem_annee = (@year + 1))
			   )
		 and not EXISTS (select cont_num from #prepa_affiche_recu where cont_num = tempBC.cont_num and sup_id = tempBC.sup_id and FromBroadcast = 1 and sem_num = tempBC.sem_num and plt_id = tempBC.plt_id) 
		  group by plt_id ,sup_id ,cont_num ,Surface ,rpc_annonceur ,rpc_num_aff_amt ,rpc_theme ,Qte_Theorique,sem_num,sem_annee,repiquage,IdDAChapeau

	  End

	  MERGE dbo.tf_prepa_affiche AS C
	  USING #travail AS S
	  ON (
	  C.plt_id = S.plt_id and
	  C.sup_id = S.sup_id and
	  C.cont_num = S.sup_id and
	  C.[Format] = S.[Format] and
	  C.rpc_annonceur = S.rpc_annonceur and
	  C.rpc_num_aff_amt = S.rpc_num_aff_amt and
	  C.rpc_theme = S.rpc_theme and
	  C.Qte_Theorique = S.Qte_Theorique and
	  C.sem_num = S.sem_num and
	  C.sem_annee = S.sem_annee and
	  C.FromBroadcast = S.FromBroadcast and
	  C.dateCreated = S.dateCreated and
	  C.dateModified = S.dateModified and
	  C.repiquage = S.repiquage and
	  C.IdDAChapeau = S.IdDAChapeau and
	  C.ate_id  = S.ate_id )
	  WHEN  NOT MATCHED BY TARGET THEN
      INSERT (plt_id,sup_id,cont_num,[Format],rpc_annonceur,rpc_num_aff_amt,rpc_theme,Qte_Theorique,sem_num,sem_annee,FromBroadcast,dateCreated,dateModified,repiquage,IdDAChapeau,ate_id)
	  VALUES (plt_id,sup_id,cont_num,[Format],rpc_annonceur,rpc_num_aff_amt,rpc_theme,Qte_Theorique,sem_num,sem_annee,FromBroadcast,dateCreated,dateModified,repiquage,IdDAChapeau,ate_id)
	  output inserted.Id
	  into @inserted
	  ;
	   --output inserted.Id
	   --into @inserted

	  -- on met � jours le flag ARecevoir = 1 pour les nouvelles prepa arriv� (cont_num) et qui ont �t� d�ja recu
	 update tf_prepa_affiche set ARecevoir = 1,dateModified = GETDATE()  
	  where 
	   EXISTS (select cont_num from #List_Cont_num_Received where cont_num = tf_prepa_affiche.cont_num and sup_id = tf_prepa_affiche.sup_id
	           and sem_num = tf_prepa_affiche.sem_num and plt_id = tf_prepa_affiche.plt_id and (tf_prepa_affiche.rpc_theme = theme or tf_prepa_affiche.rpc_theme is null)) 

-- IT-62195 - Doublon CIRCE R�ception d�but--
	   	UPDATE
    Table_A
SET
    Table_A.rpc_theme = Table_B.rpc_theme,
    Table_A.rpc_annonceur = Table_B.rpc_annonceur,
	Table_A.Qte_Theorique = Table_B.Qte_Theorique
FROM
    tf_prepa_affiche AS Table_A
    INNER JOIN #temp_tf_prepa_Broadcast AS Table_B
        ON Table_A.cont_num = Table_B.cont_num and Table_A.sup_id = Table_B.sup_id 
		and Table_A.sem_annee = Table_B.sem_annee and Table_A.sem_num = Table_B.sem_num
		and Table_A.plt_id = Table_B.plt_id
WHERE
    Table_A.FromBroadcast = 1

-- IT-62195 - Doublon CIRCE R�ception fin--

	-- on met � jours le flag FromBroadcast = null pour les pr�pa envoy�s IT-62066 - Raccrochage CIRCE impossible d�but --
   select 
      prep.plt_id,prep.sup_id,prep.cont_num,prep.[Format],prep.rpc_annonceur,prep.rpc_theme,prep.sem_num,prep.sem_annee,COUNT(prep.Id) total, Sum(case when FromBroadcast = 1 then 1 else 0 end) Nbr1, Sum(case when FromBroadcast is null then 1 else 0 end) NbrNull
    into
      #tempPrepa_affiche
    from 
      tf_prepa_affiche prep
    GROUP BY
      prep.plt_id,prep.plt_id,prep.sup_id,prep.cont_num,prep.[Format],prep.rpc_annonceur,prep.rpc_theme,prep.sem_num,prep.sem_annee

  select
    prep.Id
  into
    #ListIds
  from
	 tf_prepa_affiche AS prep
	INNER JOIN tr_atelier atelier
	    ON prep.plt_id = atelier.plt_id
    INNER JOIN tf_repart_calcul AS repart 
        ON prep.cont_num = repart.cont_num and prep.sup_id = repart.sup_id and prep.rpc_annonceur = repart.rpc_annonceur
		and prep.sem_annee = repart.sem_annee and prep.sem_num = repart.sem_num and prep.rpc_theme = repart.rpc_theme
	INNER JOIN #tempPrepa_affiche tempPrep
	     ON prep.cont_num = tempPrep.cont_num and prep.sup_id = tempPrep.sup_id and prep.rpc_annonceur = tempPrep.rpc_annonceur
		and prep.sem_annee = tempPrep.sem_annee and prep.sem_num = tempPrep.sem_num and prep.rpc_theme = tempPrep.rpc_theme
   where
     prep.FromBroadcast = 1 and repart.rpc_statut <> 4 and tempPrep.total = tempPrep.Nbr1
   GROUP BY
     prep.Id,prep.plt_id,prep.plt_id,prep.sup_id,prep.cont_num,prep.[Format],prep.rpc_annonceur,prep.rpc_theme,prep.sem_num,prep.sem_annee

	
	select cont_num,sup_id,cont_annonc,dep_anbas,dep_sembas,theme,rpc_statut
	into #ftrain
	from tf_face_train
	where  rdep_datdep > @now 



  insert into
    #ListIds(Id)
  select
    prep.Id
  from
	 tf_prepa_affiche AS prep
	INNER JOIN tr_atelier atelier
	    ON prep.plt_id = atelier.plt_id
	INNER JOIN #tempPrepa_affiche tempPrep
	     ON prep.cont_num = tempPrep.cont_num and prep.sup_id = tempPrep.sup_id and prep.rpc_annonceur = tempPrep.rpc_annonceur
		and prep.sem_annee = tempPrep.sem_annee and prep.sem_num = tempPrep.sem_num and prep.rpc_theme = tempPrep.rpc_theme
    INNER JOIN #ftrain AS ftrain 
        ON prep.cont_num = ftrain.cont_num and prep.sup_id = ftrain.sup_id and prep.rpc_annonceur = ftrain.cont_annonc
		and prep.sem_annee = ftrain.dep_anbas and prep.sem_num = ftrain.dep_sembas and prep.rpc_theme = ftrain.theme	
   where
     prep.FromBroadcast = 1 and ftrain.rpc_statut <> 4 and tempPrep.total = tempPrep.Nbr1
   GROUP BY
     prep.Id,prep.plt_id,prep.plt_id,prep.sup_id,prep.cont_num,prep.[Format],prep.rpc_annonceur,prep.rpc_theme,prep.sem_num,prep.sem_annee

    UPDATE
     tf_prepa_affiche
    SET
     tf_prepa_affiche.FromBroadcast = null
	WHERE
	tf_prepa_affiche.Id in
	(	select Id
		from #ListIds	)
	 
-- Gestion bandeau
	 if((@week + 8) <= @maxWeekPerYear)
	  Begin
			insert into #temp(repiquage ,cont_num ,quantite ,sem_num ,sem_annee ,plt_id ,sup_id ,rpc_annonceur ,ate_id )
			select distinct 
				 cal.rpc_repiquage as 'repiquage'
				,cal.cont_num
				,sum(rpc_qte) as quantite
				,cal.sem_num
				,cal.sem_annee
				,at.plt_id
				,case 
					when cal.sup_id in (5,26,1026) then 100
					when cal.sup_id = 19 then 102
					when cal.sup_id = 27 then 105
				 end as sup_id,
				 cal.rpc_annonceur,
				 cal.ate_id
			from tf_prepa_affiche tf 
			join tf_repart_calcul cal on tf.sem_num = cal.sem_num 
										and cal.sem_annee = tf.sem_annee 
										and tf.cont_num = cal.cont_num 
										and tf.sup_id = cal.sup_id 
										and tf.rpc_theme = cal.rpc_theme
			join tr_atelier at on at.ate_id = cal.ate_id
			where cal.sup_id in (5,26,1026,19,27) and cal.rpc_repiquage is not null and 
					rpc_statut <> 4 and cal.sem_num between (@week) and (@week + 8) and cal.sem_annee = @year
			group by  cal.rpc_repiquage,cal.cont_num,cal.sem_num,cal.sem_annee, at.plt_id,cal.sup_id,cal.rpc_annonceur,cal.ate_id
			order by repiquage
			
			insert into #temp(repiquage ,cont_num ,quantite ,sem_num ,sem_annee ,plt_id ,sup_id ,rpc_annonceur ,ate_id )
			select distinct 
				tr.repiquage  as 'repiquage'
				,tr.cont_num
				,count(tr.repiquage) as quantite
				,tr.cont_sembas as 'sem_num'
				,tr.cont_anbas as 'sem_annee'
				,at.plt_id
				,case 
					when tr.sup_id in (5,26,1026) then 100
					when tr.sup_id = 19 then 102
					when tr.sup_id = 27 then 105
					when tr.sup_id = 29 then 107
				 end as sup_id,
				 rpc_annonceur,
				 tr.ate_id
			from tf_prepa_affiche tf 
			join tf_face_train tr on tf.sem_num = tr.cont_sembas 
									 and tr.cont_anbas = tf.sem_annee 
									 and tf.cont_num = tr.cont_num 
									 and tf.sup_id = tr.sup_id
									 and tr.theme = tf.rpc_theme
			join tr_atelier at on at.ate_id = tr.ate_id
			where tr.sup_id in (5,26,1026,19,27,29) and tr.repiquage is not null and 
					rpc_statut <> 4 and tr.cont_sembas between (@week) and (@week + 8)  and tr.cont_anbas = @year
			group by  rpc_annonceur
				 ,tr.ate_id
				 ,tr.repiquage 
				,tr.cont_num
				,tr.cont_sembas
				,tr.cont_anbas
				,at.plt_id
				,tr.sup_id

		END
	  ELSE
	   BEGIN
	   insert into #temp(repiquage ,cont_num ,quantite ,sem_num ,sem_annee ,plt_id ,sup_id ,rpc_annonceur ,ate_id )
			select distinct 
				 cal.rpc_repiquage as 'repiquage'
				,cal.cont_num
				,sum(rpc_qte) as quantite
				,cal.sem_num
				,cal.sem_annee
				,at.plt_id
				,case 
					when cal.sup_id in (5,26,1026) then 100
					when cal.sup_id = 19 then 102
					when cal.sup_id = 27 then 105
				 end as sup_id,
				 cal.rpc_annonceur,
				 cal.ate_id
			from tf_prepa_affiche tf 
			join tf_repart_calcul cal on tf.sem_num = cal.sem_num 
										and cal.sem_annee = tf.sem_annee 
										and tf.cont_num = cal.cont_num 
										and tf.sup_id = cal.sup_id 
										and tf.rpc_theme = cal.rpc_theme
			join tr_atelier at on at.ate_id = cal.ate_id
			where cal.sup_id in (5,26,1026,19,27) and cal.rpc_repiquage is not null and 
					rpc_statut <> 4 
					and ((cal.sem_num between (@week) and (@maxWeekPerYear) and cal.sem_annee = @year)
					or (cal.sem_num between 1 and (1+ (8-(@maxWeekPerYear - @week))) and cal.sem_annee = (@year + 1)))
			group by  cal.rpc_repiquage,cal.cont_num,cal.sem_num,cal.sem_annee, at.plt_id,cal.sup_id,cal.rpc_annonceur,cal.ate_id
			order by repiquage
			
			insert into #temp(repiquage ,cont_num ,quantite ,sem_num ,sem_annee ,plt_id ,sup_id ,rpc_annonceur ,ate_id )
			select distinct 
				tr.repiquage  as 'repiquage'
				,tr.cont_num
				,count(tr.repiquage) as quantite
				,tr.cont_sembas as 'sem_num'
				,tr.cont_anbas as 'sem_annee'
				,at.plt_id
				,case 
					when tr.sup_id in (5,26,1026) then 100
					when tr.sup_id = 19 then 102
					when tr.sup_id = 27 then 105
					when tr.sup_id = 29 then 107
				 end as sup_id,
				 rpc_annonceur,
				 tr.ate_id
			from tf_prepa_affiche tf 
			join tf_face_train tr on tf.sem_num = tr.cont_sembas 
									 and tr.cont_anbas = tf.sem_annee 
									 and tf.cont_num = tr.cont_num 
									 and tf.sup_id = tr.sup_id
									 and tr.theme = tf.rpc_theme
			join tr_atelier at on at.ate_id = tr.ate_id
			where tr.sup_id in (5,26,1026,19,27,29) and tr.repiquage is not null and 
					rpc_statut <> 4 
					and ((tr.cont_sembas between (@week) and (@maxWeekPerYear) and cont_anbas = @year)
		              or (cont_sembas between 1 and (1+ (8-(@maxWeekPerYear - @week))) and cont_anbas = (@year + 1)))
			group by  rpc_annonceur
				 ,tr.ate_id
				 ,tr.repiquage 
				,tr.cont_num
				,tr.cont_sembas
				,tr.cont_anbas
				,at.plt_id
				,tr.sup_id

				
	   END


insert into #bandeau (
	theme
	,dossier
	,quantite
	,semaine
	,annee
	,plt_id
	,sup_id
	,annonceur
	,ate_id
)
select distinct
		repiquage,
		cont_num,
		sum(quantite),
		sem_num,
		sem_annee,
		plt_id,
		sup_id,
		rpc_annonceur,
		ate_id
from #temp
group by  repiquage,cont_num,sem_num,sem_annee, plt_id,sup_id,rpc_annonceur,ate_id

update tfp set Qte_Theorique = quantite , tfp.ate_id = bnd.ate_id
from #bandeau bnd  
inner join tf_prepa_affiche tfp on tfp.rpc_theme = bnd.theme
								and tfp.sup_id = bnd.sup_id
								and tfp.cont_num = bnd.dossier
								and tfp.sem_num = bnd.semaine
								and tfp.sem_annee = bnd.annee
								and tfp.ate_id = bnd.ate_id

insert into tf_prepa_affiche (plt_id,sup_id,cont_num,Format,rpc_theme, rpc_annonceur, Qte_Theorique,sem_num,sem_annee,dateCreated, dateModified,ate_id)
select  bnd.plt_id,
	   bnd.sup_id,
	   bnd.dossier,
	   sup.sup_nom,
	   bnd.theme,
	   bnd.annonceur,
	   bnd.quantite,
	   bnd.semaine,
	   bnd.annee,
	   GETDATE(),
	   GETDATE(),
	   bnd.ate_id 
	   from #bandeau bnd
left join tf_prepa_affiche tfp  on (tfp.rpc_theme = bnd.theme
								and tfp.sup_id = bnd.sup_id
								and tfp.cont_num = bnd.dossier
								and tfp.sem_num = bnd.semaine
								and tfp.sem_annee = bnd.annee
								and tfp.ate_id = bnd.ate_id)
inner join tr_categorie_support sup on sup.sup_id = bnd.sup_id
where tfp.rpc_theme is null 

-- mettre a jour DAChapeau

select distinct bcd.IdDAChapeau, tf.cont_num,tf.sem_annee,tf.sem_num
into #tempDA
from tf_prepa_affiche tf 
inner join @inserted ins on tf.Id = ins.id
inner join tf_prepa_Broadcast bcd on tf.cont_num = bcd.IdDossierDeVenteChapeau and tf.sem_num = bcd.sem_num and tf.sem_annee = bcd.sem_annee
where tf.IdDAChapeau is null

update tf
set tf.IdDAChapeau = da.IdDAChapeau
from tf_prepa_affiche   tf
inner join #tempDA da on tf.cont_num = da.cont_num 
					  and tf.sem_annee = da.sem_annee
					  and tf.sem_num = da.sem_num

-- on met � jours le flag FromBroadcast = null pour les pr�pa envoy�s IT-62066 - Raccrochage CIRCE impossible fin --

	   select @error = @@error	
if (@error<>0) GOTO Error_Handler

     Commit tran

	 drop table #prepa_affiche_recu
	drop table #bandeau
	drop table #List_Cont_num_Received
	drop table #ListIds
	drop table #temp
	drop table #temp_tf_prepa_Broadcast
	drop table #tempDA
	drop table #tempPrepa_affiche
	drop table #ftrain


Error_Handler:
if @error <> 0
 	BEGIN 

	ROLLBACK TRAN  
	return 1
   	END

END

;;;;;;;

GO
/****** Object:  StoredProcedure [dbo].[p_archivage_allTables]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[p_archivage_allTables]
	-- Add the parameters for the stored procedure here
	@keepweeksback int,
	@keepdaysback int
AS
BEGIN
-- =============================================
-- Author:		Jerbi Omar
-- Create date: 18/10/2017
-- Description:	Automated Process of data archiving all tables
-- =============================================
	SET NOCOUNT ON;

    
	exec p_archivage_tf_repart_calcul @keepweeksback
	exec p_archivage_tf_face_train @keepweeksback
	exec p_archivage_tf_UM_colis @keepdaysback
	exec p_archivage_tf_colis @keepdaysback
	exec p_archivage_tf_UM @keepweeksback

END
;
GO
/****** Object:  StoredProcedure [dbo].[p_archivage_tf_colis]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[p_archivage_tf_colis]
	-- Add the parameters for the stored procedure here
	@keepdaysback int
AS
BEGIN
-- =============================================
-- Author:		Jerbi Omar
-- Create date: 17/10/2017
-- Description:	Automated Process of data archiving tf_colis
-- =============================================
	SET NOCOUNT ON;


DECLARE @maxIdArchived int = 0, @currentDay datetime,@RowsExpected int , @compteur int = 0, @keepdaysbackDate datetime
   
select @currentDay =  getdate()

create table #tmp_id_constraint (id int)
create table #tmp_tf_colis (
    [colis_id] [int] NOT NULL,
	[fc_col_id] [int] NULL,
	[colis_code] [varchar](20) NULL,
	[rpc_statut] [tinyint] NULL,
	[dest_id] [int] NULL,
	[ate_id] [smallint] NULL,
	[colis_dat_expe] [datetime] NULL,
	[tsp_id] [int] NULL,
	[tarif_code] [varchar](20) NULL,
	[adr_id] [int] NULL,
	[adr_destinataire] [varchar](50) NULL,
	[adr_num_voie] [varchar](50) NULL,
	[adr_type_voie] [varchar](50) NULL,
	[adr_voie] [varchar](100) NULL,
	[adr_lieu_dit] [varchar](50) NULL,
	[adr_localite] [varchar](50) NULL,
	[adr_code_postal] [varchar](5) NULL,
	[adr_cedex] [varchar](50) NULL,
	[colis_dat_cre] [datetime] NULL,
	[colis_dat_maj] [datetime] NULL,
	[colis_user] [varchar](30) NULL,
	[colis_code_ext] [varchar](50) NULL,
	[colis_poids] [float] NULL,
	[commentaire] [varchar](max) NULL,
	)

set @keepdaysbackDate = DATEADD (dd , -@keepdaysback , @currentDay ) 

select @RowsExpected = count(colis_id) from tf_colis 
                         where colis_dat_cre <  CAST(@keepdaysbackDate AS date)	

while (@compteur < @RowsExpected)
  Begin

  Insert into #tmp_tf_colis(
                  [colis_id] ,[fc_col_id],[colis_code],[rpc_statut],[dest_id],[ate_id],[colis_dat_expe],[tsp_id],[tarif_code],[adr_id]
                 ,[adr_destinataire],[adr_num_voie] ,[adr_type_voie],[adr_voie],[adr_lieu_dit],[adr_localite],[adr_code_postal],[adr_cedex]
                 ,[colis_dat_cre],[colis_dat_maj],[colis_user],[colis_code_ext],[colis_poids],[commentaire]
  )
   select top(2000) 
                  [colis_id] ,[fc_col_id],[colis_code],[rpc_statut],[dest_id],[ate_id],[colis_dat_expe],[tsp_id],[tarif_code],[adr_id]
                 ,[adr_destinataire],[adr_num_voie] ,[adr_type_voie],[adr_voie],[adr_lieu_dit],[adr_localite],[adr_code_postal],[adr_cedex]
                 ,[colis_dat_cre],[colis_dat_maj],[colis_user],[colis_code_ext],[colis_poids],[commentaire]
   from tf_colis
    where  colis_dat_cre <  CAST(@keepdaysbackDate AS date) and colis_id > @maxIdArchived
	 order by colis_id

    select @maxIdArchived = max(colis_id) from #tmp_tf_colis
	select @compteur += count (colis_id) from #tmp_tf_colis


    insert into #tmp_id_constraint (id)
	select distinct(tfc.colis_id) from tf_face_train tft join #tmp_tf_colis tfc on tft.colis_id = tfc.colis_id

	insert into #tmp_id_constraint (id)
	select distinct(tfc.colis_id) from tf_UM_colis tft join #tmp_tf_colis tfc on tft.colis_id = tfc.colis_id

	
    delete tf from #tmp_tf_colis tf
              join #tmp_id_constraint t on t.id = tf.colis_id;
	BEGIN TRY
     BEGIN TRANSACTION;
	 Insert into ARCH_tf_colis(
	              [colis_id] ,[fc_col_id],[colis_code],[rpc_statut],[dest_id],[ate_id],[colis_dat_expe],[tsp_id],[tarif_code],[adr_id]
                 ,[adr_destinataire],[adr_num_voie] ,[adr_type_voie],[adr_voie],[adr_lieu_dit],[adr_localite],[adr_code_postal],[adr_cedex]
                 ,[colis_dat_cre],[colis_dat_maj],[colis_user],[colis_code_ext],[colis_poids],ArchiveDate,[commentaire]
	)
         select   [colis_id] ,[fc_col_id],[colis_code],[rpc_statut],[dest_id],[ate_id],[colis_dat_expe],[tsp_id],[tarif_code],[adr_id]
                 ,[adr_destinataire],[adr_num_voie] ,[adr_type_voie],[adr_voie],[adr_lieu_dit],[adr_localite],[adr_code_postal],[adr_cedex]
                 ,[colis_dat_cre],[colis_dat_maj],[colis_user],[colis_code_ext],[colis_poids],GETDATE(),[commentaire]
     from #tmp_tf_colis
	  COMMIT TRANSACTION;
     END TRY

	  BEGIN CATCH
    -- Execute error retrieval routine.
	    print 'error insert'
	    EXECUTE p_GetErrorInfo;

	 END CATCH

	 BEGIN TRY
      BEGIN TRANSACTION;

    delete tf from dbo.tf_colis tf
              join #tmp_tf_colis t on t.colis_id = tf.colis_id;

      COMMIT TRANSACTION;
     END TRY

	   BEGIN CATCH
    -- Execute error retrieval routine.
	    print 'error delete'
	    EXECUTE p_GetErrorInfo;
		
	  END CATCH

    delete from #tmp_tf_colis
	delete from #tmp_id_constraint
	print 'yes'
	print @maxIdArchived
	print @compteur
	print @RowsExpected

  End
  
   drop table #tmp_id_constraint
   drop table #tmp_tf_colis

END

;;
GO
/****** Object:  StoredProcedure [dbo].[p_archivage_tf_face_train]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[p_archivage_tf_face_train]
	-- Add the parameters for the stored procedure here
	@keepweeksback int
AS
BEGIN
-- =============================================
-- Author:		Jerbi Omar
-- Create date: 17/10/2017
-- Description:	Automated Process of data archiving tf_face_train
-- =============================================
	SET NOCOUNT ON;

	DECLARE @maxIdArchived int = 0, @maxWeekPerYear int, @current_sem_num int, @currentYear int,@RowsExpected int , @compteur int = 0
   
select @maxWeekPerYear = DATEPART( wk, '2017-12-31'),@current_sem_num =  DATEPART( wk, GETDATE()), @currentYear = year(getdate());


create table #tmp_tf_face_train ([ft_id] [int] NOT NULL,
	[dest_id] [int] NULL,
	[rpc_statut] [tinyint] NULL,
	[ate_id] [smallint] NULL,
	[sup_id] [smallint] NULL,
	[instr_code] [varchar](18) NOT NULL,
	[cadr_ident] [numeric](9, 0) NOT NULL,
	[cadre_lib] [varchar](20) NULL,
	[rdep_datdep] [smalldatetime] NOT NULL,
	[empl_ident] [numeric](9, 0) NULL,
	[pers_ident] [numeric](9, 0) NULL,
	[pers_nom] [varchar](50) NULL,
	[tyaf_code] [smallint] NULL,
	[reac_code] [tinyint] NULL,
	[typr_code] [tinyint] NULL,
	[cont_sembas] [tinyint] NULL,
	[cont_anbas] [smallint] NULL,
	[cont_num] [int] NULL,
	[cont_annonc] [varchar](30) NULL,
	[empl_sect_code] [smallint] NULL,
	[empl_depa_code] [char](2) NULL,
	[comm_numord] [smallint] NULL,
	[empl_numord] [smallint] NULL,
	[empl_addresse1] [varchar](30) NULL,
	[empl_addresse2] [varchar](30) NULL,
	[empl_addresse3] [varchar](30) NULL,
	[cadr_lettre] [char](1) NULL,
	[form_larg] [smallint] NULL,
	[form_haut] [smallint] NULL,
	[agreement] [varchar](50) NULL,
	[train] [tinyint] NULL,
	[rang] [tinyint] NULL,
	[rese_ident] [numeric](9, 0) NULL,
	[idre_nom] [varchar](50) NULL,
	[panel_ident] [numeric](9, 0) NULL,
	[ft_dat_cre] [datetime] NULL,
	[ft_dat_maj] [datetime] NULL,
	[ft_user_maj] [varchar](20) NULL,
	[theme] [varchar](50) NULL,
	[theme_id] [int] NULL,
	[repiquage] [varchar](50) NULL,
	[repiquage_id] [int] NULL,
	[commune] [varchar](50) NULL,
	[train_id] [varchar](20) NULL,
	[ordre_propose] [tinyint] NULL,
	[ordre_reel] [tinyint] NULL,
	[insv_id] [int] NULL,
	[dep_sembas] [tinyint] NULL,
	[dep_anbas] [smallint] NULL,
	[ft_type] [varchar](15) NULL,
	[version] [tinyint] NULL,
	[rouleur_id] [int] NULL,
	[colis_id] [int] NULL,
	[pre_assemblage] [bit] NULL DEFAULT ((0)),
	[IdFaceOTAffichage] int NULL,
	[CodeUniteUrbaine] [varchar](10) NULL,
	[Conservation] int NULL,
	[CoteCote] tinyint NULL
	)

set @keepweeksback = @current_sem_num-@keepweeksback;
set @keepweeksback = convert (varchar,@currentYear) + right ('0'+ convert (varchar,@keepweeksback),2)

select @RowsExpected = count(ft_id) from tf_face_train
                        where (convert (varchar,dep_anbas) + right ('0'+ convert (varchar,dep_sembas),2)) < @keepweeksback


 while (@compteur < @RowsExpected)
  Begin
  
   Insert into #tmp_tf_face_train(
                   [ft_id],[dest_id],[rpc_statut] ,[ate_id],[sup_id],[instr_code],[cadr_ident],[cadre_lib],[rdep_datdep],[empl_ident],[pers_ident]
                  ,[pers_nom],[tyaf_code],[reac_code],[typr_code],[cont_sembas] ,[cont_anbas] ,[cont_num] ,[cont_annonc],[empl_sect_code],[empl_depa_code],[comm_numord]
                  ,[empl_numord],[empl_addresse1] ,[empl_addresse2], [empl_addresse3], [cadr_lettre] ,[form_larg] ,[form_haut],[agreement],[train] ,[rang],[rese_ident] ,[idre_nom],[panel_ident]
                  ,[ft_dat_cre],[ft_dat_maj],[ft_user_maj] ,[theme] ,[theme_id],[repiquage],[repiquage_id],[commune] ,[train_id],[ordre_propose],[ordre_reel],[insv_id]
                  ,[dep_sembas]  ,[dep_anbas],[ft_type],[version],[rouleur_id],[colis_id],[pre_assemblage],[IdFaceOTAffichage],[CodeUniteUrbaine],[Conservation],[CoteCote]
  )
   select top(2000) [ft_id],[dest_id],[rpc_statut] ,[ate_id],[sup_id],[instr_code],[cadr_ident],[cadre_lib],[rdep_datdep],[empl_ident],[pers_ident]
                   ,[pers_nom],[tyaf_code],[reac_code],[typr_code],[cont_sembas] ,[cont_anbas] ,[cont_num] ,[cont_annonc],[empl_sect_code],[empl_depa_code],[comm_numord]
                   ,[empl_numord],[empl_addresse1] ,[empl_addresse2], [empl_addresse3], [cadr_lettre] ,[form_larg] ,[form_haut],[agreement],[train] ,[rang],[rese_ident] ,[idre_nom],[panel_ident]
                   ,[ft_dat_cre],[ft_dat_maj],[ft_user_maj] ,[theme] ,[theme_id],[repiquage],[repiquage_id],[commune] ,[train_id],[ordre_propose],[ordre_reel],[insv_id]
                   ,[dep_sembas]  ,[dep_anbas],[ft_type],[version],[rouleur_id],[colis_id],[pre_assemblage],[IdFaceOTAffichage],[CodeUniteUrbaine],[Conservation],[CoteCote]
   from tf_face_train
    where (convert (varchar,dep_anbas) + right ('0'+ convert (varchar,dep_sembas),2)) < @keepweeksback
	 order by ft_id
 
 
	select @maxIdArchived = max(ft_id) from #tmp_tf_face_train
	select @compteur += count (ft_id) from #tmp_tf_face_train

	 BEGIN TRY
      BEGIN TRANSACTION;
	 Insert into ARCH_tf_face_train(
                   [ft_id],[dest_id],[rpc_statut] ,[ate_id],[sup_id],[instr_code],[cadr_ident],[cadre_lib],[rdep_datdep],[empl_ident],[pers_ident]
                  ,[pers_nom],[tyaf_code],[reac_code],[typr_code],[cont_sembas] ,[cont_anbas] ,[cont_num] ,[cont_annonc],[empl_sect_code],[empl_depa_code],[comm_numord]
                  ,[empl_numord],[empl_addresse1] ,[empl_addresse2], [empl_addresse3], [cadr_lettre] ,[form_larg] ,[form_haut],[agreement],[train] ,[rang],[rese_ident] ,[idre_nom],[panel_ident]
                  ,[ft_dat_cre],[ft_dat_maj],[ft_user_maj] ,[theme] ,[theme_id],[repiquage],[repiquage_id],[commune] ,[train_id],[ordre_propose],[ordre_reel],[insv_id]
                  ,[dep_sembas]  ,[dep_anbas],[ft_type],[version],[rouleur_id],[colis_id],[pre_assemblage],ArchiveDate,[IdFaceOTAffichage],[CodeUniteUrbaine],[Conservation],[CoteCote]
  
  )
     select        [ft_id],[dest_id],[rpc_statut] ,[ate_id],[sup_id],[instr_code],[cadr_ident],[cadre_lib],[rdep_datdep],[empl_ident],[pers_ident]
                  ,[pers_nom],[tyaf_code],[reac_code],[typr_code],[cont_sembas] ,[cont_anbas] ,[cont_num] ,[cont_annonc],[empl_sect_code],[empl_depa_code],[comm_numord]
                  ,[empl_numord],[empl_addresse1] ,[empl_addresse2], [empl_addresse3], [cadr_lettre] ,[form_larg] ,[form_haut],[agreement],[train] ,[rang],[rese_ident] ,[idre_nom],[panel_ident]
                  ,[ft_dat_cre],[ft_dat_maj],[ft_user_maj] ,[theme] ,[theme_id],[repiquage],[repiquage_id],[commune] ,[train_id],[ordre_propose],[ordre_reel],[insv_id]
                  ,[dep_sembas]  ,[dep_anbas],[ft_type],[version],[rouleur_id],[colis_id],[pre_assemblage],GETDATE(),[IdFaceOTAffichage],[CodeUniteUrbaine],[Conservation],[CoteCote]
     from #tmp_tf_face_train
	  COMMIT TRANSACTION;
     END TRY

	 BEGIN CATCH
    -- Execute error retrieval routine.
	    print 'error insert'
	    EXECUTE p_GetErrorInfo;

	 END CATCH

	 BEGIN TRY
      BEGIN TRANSACTION;

    delete tf from dbo.tf_face_train tf
              join #tmp_tf_face_train t on t.ft_id = tf.ft_id;
      COMMIT TRANSACTION;
     END TRY

	  BEGIN CATCH
    -- Execute error retrieval routine.
	    print 'error delete'
	    EXECUTE p_GetErrorInfo;
		
	  END CATCH

    delete from #tmp_tf_face_train
	print 'yes'
	print @maxIdArchived
	print @compteur
	print @RowsExpected

  End
 
 drop table #tmp_tf_face_train


   
END

;;

GO
/****** Object:  StoredProcedure [dbo].[p_archivage_tf_repart_calcul]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[p_archivage_tf_repart_calcul]
AS
BEGIN

DECLARE @YearDebutArchive int = 0;
DECLARE @WeekDebutArchive int = 0;

SELECT @WeekDebutArchive = DATEPART( wk, GETDATE());
SELECT @YearDebutArchive = DATEPART( YEAR, GETDATE()) - 3;

CREATE TABLE #inserted_lignes (rpc_id numeric(9,0), UM_id int null);

select CONCAT('Debut archivhage des lignes avant semaine ', @WeekDebutArchive ,' et ann�e ', @YearDebutArchive)

INSERT INTO ARCH_tf_repart_calcul
([rpc_id],[sup_id] ,[ate_id] ,[soc_id],[sem_num] ,[sem_annee] ,[des_id],[des_type],[des_type_adr],[tpr_id],[act_id],[rpc_type],[rpc_repartition] ,[rpc_annonceur]
                  ,[rpc_theme] ,[rpc_num_aff_amt] ,[rpc_qte],[rpc_dat_aff],[rpc_statut],[rpc_refacturation],[rpc_rpfo_ident] ,[rpc_user],[rpc_dat_cre],[rpc_dat_maj],[rpc_san_rep]
				  ,[cont_num],[numeroReception],[pers_ident],[pers_nom],[UM_id],[dest_id],[rpc_retire],[rpc_repiquage],[rpc_repiquageId],ArchiveDate)
OUTPUT INSERTED.rpc_id, inserted.UM_id
INTO #inserted_lignes
SELECT  [rpc_id],[sup_id] ,[ate_id] ,[soc_id],[sem_num] ,[sem_annee] ,[des_id],[des_type],[des_type_adr],[tpr_id],[act_id],[rpc_type],[rpc_repartition] ,[rpc_annonceur]
                  ,[rpc_theme] ,[rpc_num_aff_amt] ,[rpc_qte],[rpc_dat_aff],[rpc_statut],[rpc_refacturation],[rpc_rpfo_ident] ,[rpc_user],[rpc_dat_cre],[rpc_dat_maj],[rpc_san_rep]
				  ,[cont_num],[numeroReception],[pers_ident],[pers_nom],[UM_id],[dest_id],[rpc_retire],[rpc_repiquage],[rpc_repiquageId], GETDATE()

FROM tf_repart_calcul
WHERE 
   sem_annee < @YearDebutArchive or (sem_annee <= @YearDebutArchive and sem_num <= @WeekDebutArchive)

SELECT 'Nombre ligne repart_calcul a archiver ', count(*) from #inserted_lignes
SELECT 'Nombre um a archiver ', count(distinct UM_id) from #inserted_lignes

INSERT INTO [dbo].[ARCH_Tf_UM]
([UM_id] ,	[tpr_id] ,	[ate_id] ,	[rpc_statut]  ,	[sup_id] ,	[dest_id] ,	[sem_num]  ,	[sem_annee] ,	[UM_repartition]  ,	[UM_annonceur]  ,	[UM_theme]  ,	[UM_num_aff_amt]  ,
	[UM_qte] ,	[cont_num] ,	[pers_ident]  ,	[pers_nom]  ,	[UM_poids]  ,	[UM_code_barre]  ,	[UM_code_synthese]  ,	[UM_user]  ,	[UM_dat_cre]  ,	[UM_dat_maj]  ,	[UM_comment]  ,
	[UM_date_aff]  ,	[ArchiveDate] )


SELECT  um.[UM_id] ,	[tpr_id] ,	[ate_id] ,	[rpc_statut]  ,	[sup_id] ,	[dest_id] ,	[sem_num]  ,	[sem_annee] ,	[UM_repartition]  ,	[UM_annonceur]  ,	[UM_theme]  ,	[UM_num_aff_amt]  ,
	[UM_qte] ,	[cont_num] ,	[pers_ident]  ,	[pers_nom]  ,	[UM_poids]  ,	[UM_code_barre]  ,	[UM_code_synthese]  ,	[UM_user]  ,	[UM_dat_cre]  ,	[UM_dat_maj]  ,	[UM_comment]  ,
	[UM_date_aff]  ,	GETDATE()
FROM tf_UM um
JOIN #inserted_lignes tmp on tmp.UM_id = um.UM_id

INSERT INTO [dbo].[ARCH_tf_UM_colis]
	([UM_id] ,	[colis_id] ,	[uc_qte] ,	[uc_user] ,	[uc_dat_cre] ,	[uc_dat_maj] ,	[ArchiveDate] )
SELECT
    col.[UM_id] ,	[colis_id] ,	[uc_qte] ,	[uc_user] ,	[uc_dat_cre] ,	[uc_dat_maj] ,	GETDATE()
FROM tf_UM_colis col
JOIN #inserted_lignes tmp on tmp.UM_id = col.UM_id


SELECT 'suppression des lignes archiv�es '

DELETE col
FROM 
tf_UM_colis col
JOIN #inserted_lignes tmp on tmp.UM_id = col.UM_id

DELETE rep
FROM 
tf_repart_calcul rep
JOIN #inserted_lignes tmp on tmp.rpc_id = rep.rpc_id

DELETE um
FROM 
tf_UM um
JOIN #inserted_lignes tmp on tmp.UM_id = um.UM_id

drop table #inserted_lignes

SELECT 'fin du traitement'

End;
GO
/****** Object:  StoredProcedure [dbo].[p_archivage_tf_UM]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[p_archivage_tf_UM]
	-- Add the parameters for the stored procedure here
	@keepweeksback int
AS
BEGIN
-- =============================================
-- Author:		Jerbi Omar
-- Create date: 17/10/2017
-- Description:	Automated Process of data archiving tf_UM
-- =============================================
	
	SET NOCOUNT ON;
	
DECLARE @maxIdArchived int = 0, @maxWeekPerYear int, @current_sem_num int, @currentYear int,@RowsExpected int , @compteur int = 0
   
select @maxWeekPerYear = DATEPART( wk, '2017-12-31'),@current_sem_num =  DATEPART( wk, GETDATE()), @currentYear = year(getdate());

create table #tmp_id_constraint (id int)
create table #tmp_tf_UM ([UM_id] [int] NOT NULL,
	[tpr_id] [smallint] NULL,
	[ate_id] [smallint] NULL,
	[rpc_statut] [tinyint] NULL,
	[sup_id] [smallint] NULL,
	[dest_id] [int] NULL,
	[sem_num] [tinyint] NULL,
	[sem_annee] [smallint] NULL,
	[UM_repartition] [numeric](9, 0) NULL,
	[UM_annonceur] [varchar](50) NULL,
	[UM_theme] [varchar](50) NULL,
	[UM_num_aff_amt] [numeric](9, 0) NULL,
	[UM_qte] [int] NULL,
	[cont_num] [int] NULL,
	[pers_ident] [numeric](9, 0) NULL,
	[pers_nom] [varchar](50) NULL,
	[UM_poids] [numeric](9, 2) NULL,
	[UM_code_barre] [varchar](18) NULL,
	[UM_code_synthese] [varchar](18) NULL,
	[UM_user] [varchar](20) NULL,
	[UM_dat_cre] [smalldatetime] NULL,
	[UM_dat_maj] [smalldatetime] NULL,
	[UM_comment] [varchar](50) NULL,
	[UM_date_aff] [smalldatetime] NULL
	)

set @keepweeksback = @current_sem_num-@keepweeksback;
set @keepweeksback = convert (varchar,@currentYear) + right ('0'+ convert (varchar,@keepweeksback),2)

select @RowsExpected = count(UM_id) from tf_UM
                        where (convert (varchar,sem_annee) + right ('0'+ convert (varchar,sem_num),2)) < @keepweeksback

 while (@compteur < @RowsExpected)
  Begin

   Insert into #tmp_tf_UM(
                   [UM_id],[tpr_id],[ate_id],[rpc_statut] ,[sup_id],[dest_id],[sem_num],[sem_annee],[UM_repartition],[UM_annonceur]
                  ,[UM_theme],[UM_num_aff_amt],[UM_qte],[cont_num],[pers_ident] ,[pers_nom],[UM_poids],[UM_code_barre],[UM_code_synthese],[UM_user]
                  ,[UM_dat_cre],[UM_dat_maj],[UM_comment],[UM_date_aff]
	  )

   select top(2000) [UM_id],[tpr_id],[ate_id],[rpc_statut] ,[sup_id],[dest_id],[sem_num],[sem_annee],[UM_repartition],[UM_annonceur]
                   ,[UM_theme],[UM_num_aff_amt],[UM_qte],[cont_num],[pers_ident] ,[pers_nom],[UM_poids],[UM_code_barre],[UM_code_synthese],[UM_user]
                   ,[UM_dat_cre],[UM_dat_maj],[UM_comment],[UM_date_aff]
   from tf_UM
     where (convert (varchar,sem_annee) + right ('0'+ convert (varchar,sem_num),2)) < @keepweeksback
	  order by UM_id
	
	select @maxIdArchived = max(UM_id) from #tmp_tf_UM
	select @compteur += count (UM_id) from #tmp_tf_UM

	insert into #tmp_id_constraint (id)
	select distinct(tfc.UM_id) from tf_repart_calcul tft join #tmp_tf_UM tfc on tft.UM_id = tfc.UM_id

	insert into #tmp_id_constraint (id)
	select distinct(tfc.UM_id) from tf_UM_colis tft join #tmp_tf_UM tfc on tft.UM_id = tfc.UM_id

	
    delete tf from #tmp_tf_UM tf
              join #tmp_id_constraint t on t.id = tf.UM_id;


    BEGIN TRY
     BEGIN TRANSACTION;

	 Insert into ARCH_Tf_UM(
                   [UM_id],[tpr_id],[ate_id],[rpc_statut] ,[sup_id],[dest_id],[sem_num],[sem_annee],[UM_repartition],[UM_annonceur]
                  ,[UM_theme],[UM_num_aff_amt],[UM_qte],[cont_num],[pers_ident] ,[pers_nom],[UM_poids],[UM_code_barre],[UM_code_synthese],[UM_user]
                  ,[UM_dat_cre],[UM_dat_maj],[UM_comment],[UM_date_aff],ArchiveDate
  
  )
     select  [UM_id],[tpr_id],[ate_id],[rpc_statut] ,[sup_id],[dest_id],[sem_num],[sem_annee],[UM_repartition],[UM_annonceur]
            ,[UM_theme],[UM_num_aff_amt],[UM_qte],[cont_num],[pers_ident] ,[pers_nom],[UM_poids],[UM_code_barre],[UM_code_synthese],[UM_user]
            ,[UM_dat_cre],[UM_dat_maj],[UM_comment],[UM_date_aff],GETDATE()
     from #tmp_tf_UM
	  COMMIT TRANSACTION;
     END TRY

	 BEGIN CATCH
    -- Execute error retrieval routine.
	    print 'error insert'
	    EXECUTE p_GetErrorInfo;

	 END CATCH

	 BEGIN TRY
      BEGIN TRANSACTION;

    delete tf from dbo.tf_UM tf
              join #tmp_tf_UM t on t.UM_id = tf.UM_id;

      COMMIT TRANSACTION;
     END TRY

	  BEGIN CATCH
    -- Execute error retrieval routine.
	    print 'error delete'
	    EXECUTE p_GetErrorInfo;
		
	  END CATCH


    delete from #tmp_tf_UM
	delete from #tmp_id_constraint
	print 'yes'
	print @maxIdArchived
	print @compteur
	print @RowsExpected

  End
 
 drop table #tmp_id_constraint
 drop table #tmp_tf_UM


End
;
GO
/****** Object:  StoredProcedure [dbo].[p_archivage_tf_UM_colis]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[p_archivage_tf_UM_colis]
	-- Add the parameters for the stored procedure here
	@keepdaysback int
AS
BEGIN

-- =============================================
-- Author:		Jerbi Omar
-- Create date: 16/10/2017
-- Description:	Automated Process of data archiving tf_repart_calcul
-- =============================================

	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

DECLARE @maxIdArchived int = 0, @currentDay datetime,@RowsExpected int , @compteur int = 0, @keepdaysbackDate datetime
   
select @currentDay =  getdate()


create table #tmp_tf_UM_colis (
    [UM_id] [int] NOT NULL,
	[colis_id] [int] NOT NULL,
	[uc_qte] [int] NULL,
	[uc_user] [varchar](20) NULL,
	[uc_dat_cre] [datetime] NULL,
	[uc_dat_maj] [datetime] NULL,
	)

set @keepdaysbackDate = DATEADD (dd , -@keepdaysback , @currentDay ) 

select @RowsExpected = count(UM_id) from tf_UM_colis 
                         where uc_dat_cre <  CAST(@keepdaysbackDate AS date)	

while (@compteur < @RowsExpected)
  Begin

  Insert into #tmp_tf_UM_colis(
                  [UM_id],
                  [colis_id],
				  [uc_qte],
				  [uc_user],
				  [uc_dat_cre],
				  [uc_dat_maj]
  )
   select top(2000) 
                  [UM_id],
                  [colis_id],
				  [uc_qte],
				  [uc_user],
				  [uc_dat_cre],
				  [uc_dat_maj]
   from tf_UM_colis
    where  uc_dat_cre <  CAST(@keepdaysbackDate AS date) and UM_id > @maxIdArchived
	 order by UM_id

    select @maxIdArchived = max(UM_id) from #tmp_tf_UM_colis
	select @compteur += count (UM_id) from #tmp_tf_UM_colis

	
      BEGIN TRY
       BEGIN TRANSACTION;

	   print 'YES'

	 Insert into ARCH_tf_UM_colis([UM_id],
                  [colis_id],
				  [uc_qte],
				  [uc_user],
				  [uc_dat_cre],
				  [uc_dat_maj],
				  ArchiveDate
	)
         select   [UM_id],
                  [colis_id],
				  [uc_qte],
				  [uc_user],
				  [uc_dat_cre],
				  [uc_dat_maj],
				  GETDATE()
     from #tmp_tf_UM_colis

	  COMMIT TRANSACTION;
	  print 'OK: ' +@compteur
     END TRY

	 BEGIN CATCH
    -- Execute error retrieval routine.
	    print 'error insert'
	    EXECUTE p_GetErrorInfo;
		
	 END CATCH

	 BEGIN TRY
      BEGIN TRANSACTION;

    delete tf from dbo.tf_UM_colis tf
              join #tmp_tf_UM_colis t on t.UM_id = tf.UM_id;
      COMMIT TRANSACTION;
     END TRY

	  BEGIN CATCH
    -- Execute error retrieval routine.
	    print 'error delete'
	    EXECUTE p_GetErrorInfo;
		
	  END CATCH

    delete from #tmp_tf_UM_colis
	--delete from #tmp_id_constraint
	print 'yes'
	print @maxIdArchived
	print @compteur
	print @RowsExpected

  End
  
   --drop table #tmp_id_constraint
   drop table #tmp_tf_UM_colis

END

;
GO
/****** Object:  StoredProcedure [dbo].[p_batch]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


-- =============================================
-- Author:		Stpéhane JAOEN
-- Create date: 16/05/2008
-- Description:	Purge des tables d'historique.
-- =============================================
CREATE PROCEDURE [dbo].[p_batch]

AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

declare 	@error		int
declare 	@date_histo	datetime
declare 	@date_log	datetime

insert into tt_log (log_date, log_module, log_desc, log_acteur)
values (getdate(),'batch', 'p_batch','null')

select @error = @@error	
if (@error<>0) GOTO Error_Handler
-- la date de suppression. 2 ans glissant pour le moment

-- 2 ans glissant
select @date_histo =  dateadd ("yy",-2, getdate() )

select @error = @@error	
if (@error<>0) GOTO Error_Handler

-- 2 mois glissant
select @date_log =  dateadd ("mm",-2, getdate() )

select @error = @@error	
if (@error<>0) GOTO Error_Handler

-- Appel à la proc de batch des tables d'historiques
exec p_d_purge_histo @date_histo

select @error = @@error	
if (@error<>0) GOTO Error_Handler

BEGIN TRAN 

-- Date des tt_repart_calcul_histo
delete from tt_log  where log_date < @date_log
select @error = @@error	
if (@error<>0) GOTO Error_Handler

Commit tran

Error_Handler:
if @error <> 0
 	BEGIN 

	ROLLBACK TRAN  
	return 1
   	END
END

GO
/****** Object:  StoredProcedure [dbo].[p_batch_alimentation_circe_pex_reception]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[p_batch_alimentation_circe_pex_reception]
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	SET FMTONLY OFF

declare @currentWeek int;
declare @currentYear int;

create table #result(

affiche_id int,
cont_num  varchar(20),
cont_annonc varchar(50),
theme varchar(50),
plt_id tinyint null,
sem_num int null,
sem_annee int null,
Format varchar(50),
IdSurface int null,
estBandeau bit null,
quantite int null,
affiche_livraison_Id int null,
IdTheme int null,
IdDAChapeau int null,
id_site_ccf int null,
validationAdmin bit null
)

select @currentWeek = DATEPART(ww, getdate())
select @currentYear = DATEPART(yy, getdate())

select cont_num,
	rpc_theme  as theme ,
	sem_num,
	sem_annee,
	case [Format]
	 when  '2m2 Scrolling' then '2m2'
	 else [Format]
	end as [Format],
	affiche_livraison_Id,
	rpc_num_aff_amt as IdTheme,
	IdDAChapeau
into #source
from tf_prepa_affiche
where ((sem_annee = @currentYear and sem_num >= @currentWeek) 
	  or sem_annee > @currentYear )
	  and (FromBroadcast is null or FromBroadcast = 0)

select cont_num,
	theme ,
	sem_num,
	sem_annee,
	[Format],
	affiche_livraison_Id,
	Max(IsNUll(IdTheme,0)) as IdTheme,
	IdDAChapeau
into #prepa_affiche
from #source
group by cont_num,
	theme,
	sem_num,
	sem_annee,
	[Format],
	IdDAChapeau,
	affiche_livraison_Id

-- les affiches associés
insert into #result (affiche_id,cont_num,cont_annonc,theme,plt_id,sem_num,sem_annee,Format,IdSurface,estBandeau,affiche_livraison_Id,IdTheme,IdDAChapeau,id_site_ccf,validationAdmin,quantite)
select distinct 
	aff.affiche_id,
	CONVERT(varchar(20), isnull(tf.cont_num,0)),
	aff.cont_annonc,
	ISNULL(aff.theme , tf.theme ) as theme ,
	aff.plt_id,
	tf.sem_num,
	tf.sem_annee,
	tf.[Format],
	tra.IdSurface,
	tra.estBandeau,
	tf.affiche_livraison_Id,
	tf.IdTheme,
	tf.IdDAChapeau,
	plt.id_site_ccf,
	aff.validationAdmin,
	0
from affiche aff
	left join transcoCategSupport tra on aff.sup_id = tra.sup_id
	inner join #prepa_affiche tf on aff.affiche_id = tf.affiche_livraison_Id
	inner join tr_plateforme plt on aff.plt_id   = plt.plt_id
group by aff.affiche_id,tra.IdSurface,aff.affiche_id,
	tf.cont_num,
	aff.cont_annonc,
	tf.theme  ,
	aff.plt_id,
	tf.sem_num,
	tf.sem_annee,
	tf.[Format],
	aff.sup_id,
	aff.sup_id,
	tra.estBandeau,
	tf.affiche_livraison_Id,
	tf.IdTheme ,
	tf.IdDAChapeau,
	plt.id_site_ccf,
	aff.validationAdmin,
	aff.theme 

-- les affiches non associés
insert into #result (affiche_id,cont_num,cont_annonc,theme,plt_id,sem_num,sem_annee,Format,IdSurface,estBandeau,affiche_livraison_Id,IdTheme,IdDAChapeau,id_site_ccf,validationAdmin,quantite)
select distinct 
	aff.affiche_id,
	CONVERT(varchar(20), isnull(dsd.Dossier,0)),
	aff.cont_annonc,
	ISNULL(aff.theme , tf.theme ) as theme ,
	aff.plt_id,
	dsd.Semaine,
	dsd.Annee,
	tf.[Format],
	tra.IdSurface,
	tra.estBandeau,
	tf.affiche_livraison_Id,
	tf.IdTheme,
	tf.IdDAChapeau,
	plt.id_site_ccf,
	aff.validationAdmin,
	0
from affiche aff
left join transcoCategSupport tra on aff.sup_id = tra.sup_id
left join #prepa_affiche tf on aff.affiche_id = tf.affiche_livraison_Id
inner join tf_dossier_semaine_depart dsd on aff.affiche_id = dsd.IdAffiche
inner join tr_plateforme plt on aff.plt_id   = plt.plt_id
where ((dsd.Annee = @currentYear and dsd.Semaine >= @currentWeek)  or dsd.Annee > @currentYear)  and tf.affiche_livraison_Id is null
group by aff.affiche_id,tra.IdSurface,aff.affiche_id,
	dsd.Dossier,
	aff.cont_annonc,
	tf.IdTheme  ,
	aff.plt_id,
	dsd.Semaine,
	dsd.Annee,
	tf.[Format],
	aff.sup_id,
	aff.sup_id,
	tra.estBandeau,
	tf.affiche_livraison_Id,
	tf.theme ,
	tf.IdDAChapeau,
	plt.id_site_ccf,
	aff.validationAdmin,
	aff.theme

-- update quantite
update res  
set res.quantite = (select sum(mv.quantite) from mouvement mv where res.affiche_id = mv.affiche_id ) 
from #result res
inner join mouvement mv on res.affiche_id = mv.affiche_id  

select	affiche_id ,
		cont_num,
		cont_annonc,
		theme,
		plt_id,
		sem_num,
		sem_annee,
		[Format],
		IdSurface,
		estBandeau,
		quantite,
		affiche_livraison_Id,
		IdTheme,
		IdDAChapeau,
		id_site_ccf,
		validationAdmin 
from #result
order by affiche_id

drop table #result
drop table #source
drop table #prepa_affiche

END
;

GO
/****** Object:  StoredProcedure [dbo].[p_batch_auto_instruction_ok]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[p_batch_auto_instruction_ok]
AS
BEGIN
    SET NOCOUNT ON;

    -- ============================================================
    -- BATCH AUTO - Mise � jour statut "Instructions OK"
    -- RG1 : Dossiers au statut "En cours"
    -- RG2 : Commentaire instructions vide
    -- RG3 : Quantit� attendue = Quantit� r�ceptionn�e
    -- RG4 : Normalisation AUTOMATIQUE des pourcentages de format
    --         - Cas standard (1 visuel)      -> forcer � 100%
    --         - Cas particulier (>1 visuels) -> cr�er/forcer la ligne
    --           "Sans affiche" � 100% et les autres lignes � 0%
    -- RG5 : Mise � jour statut si RG1+RG2+RG3+RG4 OK
    -- RG6 : Tra�abilit� via instr_user
    -- ============================================================

    DECLARE @statut_en_cours  TINYINT     = 1;
    DECLARE @statut_instr_ok  TINYINT     = 2;
    DECLARE @batch_user       VARCHAR(20) = 'BATCH_AUTO_INSTR_OK';
    DECLARE @theme_sans_affiche VARCHAR(100) = 'Sans affiche';

    DECLARE @log_module        VARCHAR(50)  = OBJECT_NAME(@@PROCID);
    DECLARE @log_date          DATETIME     = GETDATE();
    DECLARE @nb_candidats      INT          = 0;
    DECLARE @nb_preselection   INT          = 0;
    DECLARE @nb_violation      INT          = 0;
    DECLARE @nb_violations_rg4 INT          = 0;
    DECLARE @nb_mis_a_jour     INT          = 0;
    DECLARE @nb_erreurs_association INT     = 0;

    -- annee ISO de aujourd'hui (et non l'annee calendaire) pour aligner
    -- la reference avec cont_sembas, qui est une semaine ISO
    DECLARE @today      DATE = CAST(GETDATE() AS DATE);
    DECLARE @isoWeekday INT  = ((DATEPART(WEEKDAY, @today) + @@DATEFIRST - 2) % 7) + 1;
    DECLARE @isoYear    INT  = YEAR(DATEADD(DAY, 4 - @isoWeekday, @today));
    DECLARE @isoWeek    INT  = DATEPART(ISO_WEEK, @today);

    BEGIN TRY
        BEGIN TRANSACTION;

    -- ETAPE 1 : Calcul des quantit�s par dossier
    --           qte_attendue     = nb lignes instruction_train
    --           qte_receptionnee = nb lignes instruction_detail
    --           li�s au m�me dossier (cont_num + cont_sembas + cont_anbas)

    -- 1a. Quantit� attendue par instr_code : nb de lignes instruction_detail

    -- 1c. Liste DISTINCTE des instr_code par dossier
    --     (instruction_train a un ate_id -> plusieurs lignes par instr_code,
    --      on d�duplique ici pour ne pas fausser les sommes ensuite)
    CREATE TABLE #instr_par_dossier (
        cont_num    INT,
        cont_sembas SMALLINT,
        cont_anbas  SMALLINT,
        instr_code  VARCHAR(18)
    );

    INSERT INTO #instr_par_dossier (cont_num, cont_sembas, cont_anbas, instr_code)
    SELECT DISTINCT it.cont_num, it.cont_sembas, it.cont_anbas, it.instr_code
    FROM [dbo].[instruction_train] it
    WHERE
        -- Filtre futur : ann�e > ann�e courante
        -- OU m�me ann�e ET semaine >= semaine courante
        it.cont_anbas > @isoYear
        OR (
            it.cont_anbas  = @isoYear
            AND it.cont_sembas >= @isoWeek
        )



           --------------------------------------------------------
            -- 1b. Quantit� attendue uniquement pour les instr_code utiles
            --------------------------------------------------------

            CREATE TABLE #det_qte (
                instr_code VARCHAR(18),
                nb_det INT
            );

            INSERT INTO #det_qte (instr_code, nb_det)
            SELECT
                d.instr_code,
                COUNT(*) AS nb_det
            FROM dbo.instruction_detail d
            INNER JOIN (
                SELECT DISTINCT instr_code
                FROM #instr_par_dossier
            ) ipd
                ON ipd.instr_code = d.instr_code
            GROUP BY d.instr_code;

            --------------------------------------------------------
            -- 1c. Quantit� r�ceptionn�e uniquement pour les instr_code utiles
            --------------------------------------------------------

            CREATE TABLE #face_qte (
                instr_code VARCHAR(18),
                nb_face INT
            );

            INSERT INTO #face_qte (instr_code, nb_face)
            SELECT
                f.instr_code,
                COUNT(*) AS nb_face
            FROM dbo.tf_face_train f
            INNER JOIN (
                SELECT DISTINCT instr_code
                FROM #instr_par_dossier
            ) ipd
                ON ipd.instr_code = f.instr_code
            GROUP BY f.instr_code;





    -- 1d. Agr�gation finale par dossier (sans fan-out : les compteurs
    --     sont d�j� agr�g�s par instr_code aux �tapes 1a/1b)
    CREATE TABLE #qte_par_dossier (
        cont_num         INT,
        cont_sembas      SMALLINT,
        cont_anbas       SMALLINT,
        qte_attendue     INT,
        qte_receptionnee INT
    );

    INSERT INTO #qte_par_dossier (
        cont_num,
        cont_sembas,
        cont_anbas,
        qte_attendue,
        qte_receptionnee
    )
    SELECT
        ipd.cont_num,
        ipd.cont_sembas,
        ipd.cont_anbas,
        SUM(ISNULL(dq.nb_det, 0))  AS qte_attendue,
        SUM(ISNULL(fq.nb_face, 0)) AS qte_receptionnee
    FROM #instr_par_dossier ipd
    LEFT JOIN #det_qte  dq ON dq.instr_code = ipd.instr_code
    LEFT JOIN #face_qte fq ON fq.instr_code = ipd.instr_code
    GROUP BY
        ipd.cont_num,
        ipd.cont_sembas,
        ipd.cont_anbas;

    -- ETAPE 2 : Pr�s�lection RG1 + RG2 + RG3 uniquement

    CREATE TABLE #dossiers_pre_selection (
        instr_code VARCHAR(18)
    );

    INSERT INTO #dossiers_pre_selection (instr_code)
    SELECT it.instr_code
    FROM [dbo].[instruction_train] it
    INNER JOIN #qte_par_dossier qd
        ON  qd.cont_num    = it.cont_num
        AND qd.cont_sembas = it.cont_sembas
        AND qd.cont_anbas  = it.cont_anbas
    WHERE
        it.rpc_statut = @statut_en_cours
        AND NULLIF(LTRIM(RTRIM(it.instr_CommentExtPlay)), '') IS NULL
        AND qd.qte_attendue = qd.qte_receptionnee;

    SELECT @nb_candidats = COUNT(*)
    FROM [dbo].[instruction_train] it
    INNER JOIN #qte_par_dossier qd
        ON  qd.cont_num    = it.cont_num
        AND qd.cont_sembas = it.cont_sembas
        AND qd.cont_anbas  = it.cont_anbas;

    SELECT @nb_preselection = COUNT(*) FROM #dossiers_pre_selection;

    SET @nb_violation = @nb_candidats - @nb_preselection;

    -- ETAPE 3 : RG4 - Normalisation automatique des pourcentages


    -- 3.1 Photo des groupes (instr_code, sup_id, tpr_id) concern�s,
    --     UNIQUEMENT pour les dossiers de la pr�s�lection
    CREATE TABLE #fmt_groups (
        instr_code           VARCHAR(18),
        sup_id                INT,
        tpr_id                INT,
        nb_visuels            INT,
        nb_sans_affiche       INT,   -- nb lignes th�me "Sans affiche" (quel que soit le %)
        nb_sans_affiche_100   INT    -- nb lignes "Sans affiche" d�j� � 100%
    );

    INSERT INTO #fmt_groups (instr_code, sup_id, tpr_id, nb_visuels, nb_sans_affiche, nb_sans_affiche_100)
    SELECT
        v.instr_code,
        v.sup_id,
        v.tpr_id,
        COUNT(*) AS nb_visuels,
        SUM(CASE WHEN v.insv_theme = @theme_sans_affiche THEN 1 ELSE 0 END) AS nb_sans_affiche,
        SUM(CASE WHEN v.insv_theme = @theme_sans_affiche
                  AND v.insv_pourcentage = 100 THEN 1 ELSE 0 END) AS nb_sans_affiche_100
    FROM [dbo].[instruction_visuels] v
    INNER JOIN #dossiers_pre_selection ps
        ON ps.instr_code = v.instr_code
    GROUP BY v.instr_code, v.sup_id, v.tpr_id;

    -- 3.2 Cas standard (1 seul visuel pour ce format) -> forcer � 100%
    UPDATE v
    SET v.insv_pourcentage = 100
    FROM [dbo].[instruction_visuels] v
    INNER JOIN #fmt_groups g
        ON  g.instr_code = v.instr_code
        AND ISNULL(g.sup_id, -1) = ISNULL(v.sup_id, -1)
        AND ISNULL(g.tpr_id, -1) = ISNULL(v.tpr_id, -1)
    WHERE g.nb_visuels = 1
      AND ISNULL(v.insv_pourcentage, -1) <> 100;

    -- 3.3 Cas particulier (plusieurs visuels pour ce format)

    -- a) Ins�rer la ligne "Sans affiche" � 100% si elle n'existe pas encore
    INSERT INTO [dbo].[instruction_visuels] (instr_code, sup_id, tpr_id, insv_theme, insv_pourcentage)
    SELECT g.instr_code, g.sup_id, g.tpr_id, @theme_sans_affiche, 100
    FROM #fmt_groups g
    WHERE g.nb_visuels > 1
      AND g.nb_sans_affiche = 0;

    -- b) Si la ligne "Sans affiche" existe d�j� mais pas � 100% -> la corriger
    UPDATE v
    SET v.insv_pourcentage = 100
    FROM [dbo].[instruction_visuels] v
    INNER JOIN #fmt_groups g
        ON  g.instr_code = v.instr_code
        AND ISNULL(g.sup_id, -1) = ISNULL(v.sup_id, -1)
        AND ISNULL(g.tpr_id, -1) = ISNULL(v.tpr_id, -1)
    WHERE g.nb_visuels > 1
      AND v.insv_theme = @theme_sans_affiche
      AND ISNULL(v.insv_pourcentage, -1) <> 100;

    -- c) Toutes les autres lignes du m�me format (th�me diff�rent de "Sans affiche") -> 0%
    UPDATE v
    SET v.insv_pourcentage = 0
    FROM [dbo].[instruction_visuels] v
    INNER JOIN #fmt_groups g
        ON  g.instr_code = v.instr_code
        AND ISNULL(g.sup_id, -1) = ISNULL(v.sup_id, -1)
        AND ISNULL(g.tpr_id, -1) = ISNULL(v.tpr_id, -1)
    WHERE g.nb_visuels > 1
      AND v.insv_theme <> @theme_sans_affiche
      AND ISNULL(v.insv_pourcentage, -1) <> 0;

    -- ETAPE 4 : Rev�rification RG4 (s�curit�) apr�s correction
    --           -> ne devrait normalement plus rien remonter,
    --              sert de garde-fou pour les cas non pr�vus

    CREATE TABLE #rg4_violations (
        instr_code VARCHAR(18)
    );

    INSERT INTO #rg4_violations (instr_code)
    SELECT DISTINCT fmt.instr_code
    FROM (
        SELECT
            instr_code, sup_id, tpr_id,
            COUNT(*) AS nb_visuels,
            SUM(CASE WHEN insv_pourcentage = 100 THEN 1 ELSE 0 END) AS nb_a_100,
            SUM(CASE WHEN insv_pourcentage = 0
                      AND insv_theme <> @theme_sans_affiche THEN 1 ELSE 0 END) AS nb_a_0,
            SUM(CASE WHEN insv_theme = @theme_sans_affiche
                      AND insv_pourcentage = 100 THEN 1 ELSE 0 END) AS nb_sans_affiche_100
        FROM [dbo].[instruction_visuels]
        WHERE instr_code IN (SELECT instr_code FROM #dossiers_pre_selection)
        GROUP BY instr_code, sup_id, tpr_id
    ) fmt
    WHERE
        (fmt.nb_visuels = 1 AND fmt.nb_a_100 <> 1)
        OR
        (fmt.nb_visuels > 1 AND NOT (
            fmt.nb_sans_affiche_100 = 1
            AND fmt.nb_a_0 = fmt.nb_visuels - 1
        ));

    CREATE TABLE #dossiers_a_mettre_a_jour (
        instr_code VARCHAR(18)
    );

    INSERT INTO #dossiers_a_mettre_a_jour (instr_code)
    SELECT instr_code
    FROM #dossiers_pre_selection
    WHERE NOT EXISTS (
        SELECT 1 FROM #rg4_violations rg4
        WHERE rg4.instr_code = #dossiers_pre_selection.instr_code
    );

    SELECT @nb_violations_rg4 = COUNT(*) FROM #rg4_violations;
    SELECT @nb_mis_a_jour     = COUNT(*) FROM #dossiers_a_mettre_a_jour;


    -- ETAPE 5 : Mise a jour statut + tracabilite + association des trains (RG5 + RG6 + RG7)
    --           Tout est fait dossier par dossier, dans un savepoint :
    --           1) instruction_train   -> rpc_statut = 2 (Instructions ok), dat_maj, user
    --           2) instruction_visuels -> meme statut, dat_maj, user (comme la validation
    --              manuelle, cf. SaveEnTeteDetailInstructionsTrain cote C#)
    --           3) p_u_statut_preparation (code 2) -> p_u_associe_train, qui associe
    --              themes/visuels/repiquages sur tf_face_train et passe son rpc_statut a 2
    --           p_u_statut_preparation ne traite qu'un instr_code a la fois (pas de version
    --           set-based) -> boucle sur les dossiers retenus.
    --
    --           L'ordre 1) avant 3) est impose : p_u_associe_train relit lui-meme
    --           instruction_train.rpc_statut et ne fait rien si celui-ci n'est pas a 2.
    --
    --           Si une des 3 operations echoue pour un dossier, le rollback au savepoint
    --           annule les 3 pour CE dossier uniquement : il reste a rpc_statut = 1
    --           (En cours) et sera represente au prochain passage du batch, comme un
    --           dossier exclu par RG1-RG4. Les dossiers deja traites dans ce run ne sont
    --           pas impactes.
    DECLARE @instr_code_assoc VARCHAR(18);

    DECLARE assoc_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT instr_code FROM #dossiers_a_mettre_a_jour;

    OPEN assoc_cursor;
    FETCH NEXT FROM assoc_cursor INTO @instr_code_assoc;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            SAVE TRANSACTION assoc_savepoint;

            UPDATE dbo.instruction_train
            SET
                rpc_statut    = @statut_instr_ok,
                instr_dat_maj = GETDATE(),
                instr_user    = @batch_user
            WHERE instr_code = @instr_code_assoc;

            UPDATE dbo.instruction_visuels
            SET
                rpc_statut   = @statut_instr_ok,
                insv_dat_maj = GETDATE(),
                insv_user    = @batch_user
            WHERE instr_code = @instr_code_assoc;

            EXEC dbo.p_u_statut_preparation
                @instr_code = @instr_code_assoc,
                @code       = @statut_instr_ok,
                @user       = @batch_user;
        END TRY
        BEGIN CATCH
            -- annule les 3 operations de CE dossier (statut train, statut visuels,
            -- association) : il reste En cours et sera retente au prochain run
            ROLLBACK TRANSACTION assoc_savepoint;

            SET @nb_erreurs_association = @nb_erreurs_association + 1;

            INSERT INTO dbo.tt_log (log_date, log_module, log_acteur, log_desc)
            VALUES (
                GETDATE(),
                @log_module,
                @batch_user,
                CONCAT('Passage Instructions ok echoue pour instr_code=', @instr_code_assoc,
                       ' - laisse En cours - ErrorNumber: ', ERROR_NUMBER(),
                       ' ErrorMessage: ', ERROR_MESSAGE())
            );
        END CATCH

        FETCH NEXT FROM assoc_cursor INTO @instr_code_assoc;
    END

    CLOSE assoc_cursor;
    DEALLOCATE assoc_cursor;

    -- Nettoyage
    DROP TABLE #det_qte;
    DROP TABLE #face_qte;
    DROP TABLE #instr_par_dossier;
    DROP TABLE #qte_par_dossier;
    DROP TABLE #fmt_groups;
    DROP TABLE #rg4_violations;
    DROP TABLE #dossiers_a_mettre_a_jour;
    DROP TABLE #dossiers_pre_selection;

    -- Log de synthese du batch (RG6 / suivi)
    INSERT INTO dbo.tt_log (log_date, log_module, log_desc, log_acteur)
    VALUES (
        @log_date,
        @log_module,
        CONCAT('Dossiers preselectionnes: ', @nb_preselection,
               ' | Violations RG1-3: ', @nb_violation,
               ' | Violations RG4: ', @nb_violations_rg4,
               ' | Dossiers mis a jour: ', @nb_mis_a_jour,
               ' | Erreurs association: ', @nb_erreurs_association),
        @batch_user
    );

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        INSERT INTO dbo.tt_log (log_date, log_module, log_acteur, log_desc)
        VALUES (
            GETDATE(),
            @log_module,
            @batch_user,
            CONCAT('ErrorNumber: ', ERROR_NUMBER(), ' ErrorSeverity: ', ERROR_SEVERITY(),
                   ' ErrorState: ', ERROR_STATE(), ' ErrorLine: ', ERROR_LINE(),
                   ' ErrorProcedure: ', ERROR_PROCEDURE(), ' ErrorMessage: ', ERROR_MESSAGE())
        );

        THROW;
    END CATCH
END;

GO
/****** Object:  StoredProcedure [dbo].[p_batch_fin_journee_colis]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[p_batch_fin_journee_colis]   
AS
BEGIN
	-- Description:	Permet d'effectuer les traitements necessaires à la fin de journée
	--              dans le processus final de l'expédition du colis.
	--
	-- Date			| User			| Description
	-- -----------------------------------------------------------------------
	-- 2015.07.08	| PCL.			| Création
	-- -----------------------------------------------------------------------
	-- 2016.06.27	| Wheeler A.	| ajout de la mise des données des trains
    
   
    declare @log_module	varchar(50),
		@now datetime,
		@user varchar(20)

	select @now = getdate(),
		@user = suser_name(),
		@log_module = object_name(@@procid)

	--  mise à jour des UM des colis
	update tf_UM
	set rpc_statut = 8, 
		UM_user = @user, 
		UM_dat_maj = @now
	from tf_colis c
	join tf_UM_colis uc on (c.colis_id = uc.colis_id)
	join tf_UM u on (uc.UM_id = u.UM_id)
	where c.rpc_statut = 7 
	      
	if @@error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @now, @log_module, 'Maj du statut des UM du colis', @user
        return -1
	end

	-- mise à jour des trains
	update tf_face_train
	set rpc_statut = 8,
		ft_dat_maj = @now,
		ft_user_maj = @user
	from tf_face_train f
	join tf_colis c on (f.colis_id = c.colis_id)
	where c.rpc_statut = 7

	if @@error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @now, @log_module, 'Maj du statut des trains du colis', @user
        return -1
	end

	-- mise à jour du colis
	update tf_colis
	set rpc_statut = 8,
		colis_user = @user,
		colis_dat_maj = @now
	where rpc_statut = 7
     
	if @@error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @now, @log_module, 'Maj du statut colis à terminé', @user
		return -1
	end
    
	-- fin de la procedure
	return 0
END
GO
/****** Object:  StoredProcedure [dbo].[p_batch_u_synchro_adresse]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- ================================================================================================
-- Author:		Patrick CLEMENT
-- Create date: 07/05/2015
-- Description:	Permet d'alimenter la table adresse tr_dest-adresse par la table tr_destination
--              elle même alimentée par les données d'AMT.
-- ================================================================================================
CREATE PROCEDURE [dbo].[p_batch_u_synchro_adresse]

AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	DECLARE @user char(8);
	SET @user = 'BAT RADR';

-- RDG : On force à actif toutes les adresses provenant d'AMT et à inactif les autres
UPDATE tr_destination set des_actif = 1, des_dat_maj = GETDATE(), des_user = @user  WHERE des_type_adr = 0
UPDATE tr_destination set des_actif = 0, des_dat_maj = GETDATE(), des_user = @user  WHERE des_type_adr <> 0
 

--Synchronisation entre la table cible tr_dest_adresse à partir de la table source tr_destination
--
MERGE tr_dest_adresse AS TARGET
USING (SELECT r.dest_id, i.* FROM tr_destination i INNER JOIN tr_destinataire r ON (i.des_id = r.des_id AND i.des_type = r.des_type)) AS SOURCE
ON (TARGET.dest_id = CAST(SOURCE.dest_id as int) AND CAST(SOURCE.des_type AS VARCHAR(10)) = TARGET.tad_cod AND SOURCE.des_actif = 1) 

WHEN MATCHED THEN
	UPDATE SET
	    TARGET.adr_num_voie = '',
		TARGET.adr_type_voie = '',
		TARGET.adr_voie = SOURCE.des_adr_1,
		TARGET.adr_lieu_dit = SOURCE.des_adr_2,
		TARGET.adr_localite = SOURCE.des_localite,
		TARGET.adr_code_postal = SOURCE.des_postal,
		TARGET.adr_cedex = '',
		TARGET.adr_dat_maj = GETDATE(),
		TARGET.adr_user_maj = @user

WHEN NOT MATCHED BY TARGET AND SOURCE.des_actif = 1 THEN 
	INSERT ([dest_id]
           ,[tad_cod]
           ,[adr_principale]
           ,[adr_num_voie]
           ,[adr_type_voie]
           ,[adr_voie]
           ,[adr_lieu_dit]
           ,[adr_localite]
           ,[adr_code_postal]
           ,[adr_cedex]
           ,[adr_dat_maj]
           ,[adr_dat_cre]
           ,[adr_user_maj]) 
	VALUES (CAST(SOURCE.dest_id as int),
         '1',
		 '',
		 '',
		 '',
		 SOURCE.des_adr_1,
		 SOURCE.des_adr_2,
		 SOURCE.des_localite,
		 SOURCE.des_postal,
		 '',
		 GETDATE(),
		 GETDATE(),
		 @user
		 )

WHEN NOT MATCHED BY SOURCE THEN 
	DELETE

OUTPUT $action, inserted.*, deleted.*;
--DELETED.ProductID AS TargetProductID, 
--DELETED.ProductName AS TargetProductName, 
--DELETED.Rate AS TargetRate, 
--INSERTED.ProductID AS SourceProductID, 
--INSERTED.ProductName AS SourceProductName, 
--INSERTED.Rate AS SourceRate; 
--SELECT @@ROWCOUNT;
END
GO
/****** Object:  StoredProcedure [dbo].[p_d_purge_histo]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================
-- Author:		Stpéhane JAOEN
-- Create date: 16/05/2008
-- Description:	Purge des tables d'historique.
-- =============================================
CREATE PROCEDURE [dbo].[p_d_purge_histo]
@le datetime

AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

    declare 	@error		int

	insert into tt_log (log_date, log_module, log_desc, log_acteur)
	values (getdate(),'batch', 'p_purge_histo : '+ convert(varchar, @le),'batch')
	
	delete from tt_log where log_date < @le
	select @error = @@error	
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(),'p_purge_histo,','tt_log', 'batch'
        return 1
	end

    
    
    -- Date des tt_repart_calcul_histo
	delete from th_amt_log_destination where dat_trait < @le
	select @error = @@error	
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(),'p_purge_histo,','th_amt_log_destination', 'batch'
        return 1
	end

	-- Date des tt_repart_calcul_histo
	delete from th_amt_log_instruction where dat_trait < @le
	select @error = @@error	
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(),'p_purge_histo,','th_amt_log_instruction', 'batch'
        return 1
	end



	-- Date des tt_repart_calcul_histo
	delete from th_amt_log_instruc_det where dat_trait < @le
	select @error = @@error	
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(),'p_purge_histo,','th_amt_log_instruc_det', 'batch'
        return 1
	end

	-- Date des tt_repart_calcul_histo
	delete from th_amt_log_repart where dat_trait < @le
	select @error = @@error	
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(),'p_purge_histo,','th_amt_log_repart', 'batch'
        return 1
	end

-- Date des tt_repart_calcul_histo
	delete from th_amt_log_statut_repart where dat_trait < @le
	select @error = @@error	
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(),'p_purge_histo,','th_amt_log_statut_repart', 'batch'
        return 1
	end

-- Date des tt_repart_calcul_histo
	delete from th_amt_log_train where dat_trait < @le
	select @error = @@error	
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(),'p_purge_histo,','th_amt_log_train', 'batch'
        return 1
	end
		
END
GO
/****** Object:  StoredProcedure [dbo].[p_EditionPicking]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[p_EditionPicking]
-- Add the parameters for the stored procedure here
	@plt_id int = null,
	@dateDebut datetime,
	@dateFin datetime,
	@affiches dbo.afficheIntegerTableType ReadOnly

AS
BEGIN
	
	-- =============================================
-- Author:		Jerbi Omar
-- Create date: 11/04/2018
-- Description:	Get data for Edition Picking
-- =============================================


	SET NOCOUNT ON;
    DECLARE @countAffiches int
	select @countAffiches = count(*) from @affiches 

 IF(@plt_id is not null)
  BEGIN
	SELECT 
	      aff.affiche_id
         ,aff.cont_num
		 ,aff.cont_annonc
		 ,aff.theme
		 ,aff.repiquage
		 ,aff.date_entree
		 ,aff.allee
		 ,aff.rayon
		 ,sum(mv.quantite) as quantite
		 ,cat.sup_nom as [format]
		 ,DATEPART( wk, aff.date_entree) as semaine
		 ,DATEPART( YEAR, aff.date_entree) as annee
		 ,ROW_NUMBER() OVER(
    PARTITION BY cat.sup_nom
    ORDER BY 
        cat.sup_nom,
        aff.cont_annonc,
        aff.cont_num
) AS [rows]

    INTO #EditionPickingTemp

	FROM affiche aff

	JOIN mouvement mv on aff.affiche_id = mv.affiche_id
	JOIN tr_categorie_support cat on aff.sup_id = cat.sup_id

	WHERE 
	     aff.plt_id = @plt_id
	 AND aff.date_entree >= @dateDebut
	 AND aff.date_entree <= @dateFin
	 AND (aff.zone_Picking is null or aff.zone_Picking = 0)
	 AND (aff.validationAdmin = 1)
	 
    GROUP BY
	      aff.affiche_id
         ,aff.cont_num
		 ,aff.cont_annonc
		 ,aff.theme
		 ,aff.repiquage
		 ,aff.date_entree
		 ,aff.allee
		 ,aff.rayon
		 --,sum(mv.quantite)
		 ,cat.sup_nom
		 ,DATEPART( wk, aff.date_entree)
		 ,DATEPART( YEAR, aff.date_entree)

	

	update #EditionPickingTemp
	SET [rows] = 0
	where [rows] <> 1
	
	SELECT * FROM #EditionPickingTemp
	DROP TABLE #EditionPickingTemp 
		
  END
   else if(@countAffiches > 0)
    BEGIN

	SELECT 
	      aff.affiche_id
         ,aff.cont_num
		 ,aff.cont_annonc
		 ,aff.theme
		 ,aff.repiquage
		 ,aff.date_entree
		 ,aff.allee
		 ,aff.rayon
		 ,sum(mv.quantite) as quantite
		 ,cat.sup_nom as [format]
		 ,DATEPART( wk, aff.date_entree) as semaine
		 ,DATEPART( YEAR, aff.date_entree) as annee
		 ,ROW_NUMBER() OVER(
    PARTITION BY cat.sup_nom
    ORDER BY 
        cat.sup_nom,
        aff.cont_annonc,
        aff.cont_num
) AS [rows]

    INTO #EditionPickingTemp2

	FROM affiche aff

	JOIN mouvement mv on aff.affiche_id = mv.affiche_id
	JOIN tr_categorie_support cat on aff.sup_id = cat.sup_id

	WHERE 
	      aff.affiche_id in (select afficheId from @affiches)
	 AND (aff.zone_Picking is null or aff.zone_Picking = 0)
	 AND (aff.validationAdmin = 1)
	 
    GROUP BY
	      aff.affiche_id
         ,aff.cont_num
		 ,aff.cont_annonc
		 ,aff.theme
		 ,aff.repiquage
		 ,aff.date_entree
		 ,aff.allee
		 ,aff.rayon
		 --,sum(mv.quantite)
		 ,cat.sup_nom
		 ,DATEPART( wk, aff.date_entree)
		 ,DATEPART( YEAR, aff.date_entree)




	update #EditionPickingTemp2
	SET [rows] = 0
	where [rows] <> 1
	
	SELECT * FROM #EditionPickingTemp2
	DROP TABLE #EditionPickingTemp2 

	END


END

;

;
GO
/****** Object:  StoredProcedure [dbo].[p_GetDataReceptionOrpheline]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

Create PROCEDURE [dbo].[p_GetDataReceptionOrpheline]
	-- Add the parameters for the stored procedure here
	@dateDebut datetime,
	@dateFin datetime,
	@plt_id int
AS
BEGIN

-- =============================================
-- Author:		Jerbi Omar
-- Create date: 2018-09-11
-- R�cup�ration des donn�es � afficher dans la grid des r�ceptions
-- =============================================


	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET FMTONLY OFF
	SET NOCOUNT ON;

	
	 SELECT
	  affiche_id,aff.sup_id,aff.plt_id,quantite,theme,cont_annonc,aff.cont_num,prep.Qte_Theorique
	 INTO
	  #tempAfficheOrpheline
	 FROM 
	  affiche aff
     LEFT JOIN
	  tf_prepa_affiche prep on aff.affiche_id = prep.affiche_livraison_Id
	where 
	  prep.affiche_livraison_Id is null 
	  and aff.plt_id = @plt_id
	  and aff.date_creation >= @dateDebut and aff.date_creation <= @dateFin


	SELECT
	 temp.affiche_id,sup.sup_nom as Format,temp.plt_id,temp.sup_id,ISNULL(temp.Qte_Theorique,0) as QteTheo,temp.theme,temp.cont_annonc,ISNULL(sum(mvt.quantite),0) as QteRec,aso.Id_livraison as LivraisonId,
	 liv.DateLivraison,aso.Id_livraison as NumeroLivraison,liv.Commentaire as Description,temp.cont_num as Dossier 
	FROM
	 #tempAfficheOrpheline temp
	JOIN
	  asso_livraison_affiche aso on temp.affiche_id = aso.Id_affiche_livraison
	JOIN 
	  mouvement mvt on temp.affiche_id = mvt.affiche_id
	JOIN
	  tr_categorie_support sup on temp.sup_id = sup.sup_id
	JOIN
	  livraison liv on aso.Id_livraison = liv.Id
	GROUP BY
	   temp.affiche_id,sup.sup_nom,temp.plt_id,temp.sup_id,temp.quantite,temp.theme,temp.cont_annonc,aso.Id_livraison ,
	 liv.DateLivraison,aso.Id_livraison ,liv.Commentaire ,temp.cont_num,temp.Qte_Theorique

	DROP TABLE #tempAfficheOrpheline

return 0;

END

GRANT EXECUTE
    ON OBJECT::[dbo].[p_GetDataReceptionOrpheline] TO [user_circe]
    AS [dbo];
;
GO
/****** Object:  StoredProcedure [dbo].[p_GetDetailColis]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE Procedure [dbo].[p_GetDetailColis]
(
	@idsColis as IdGenericList READONLY
)
AS
BEGIN
	SET FMTONLY OFF;

CREATE TABLE #res (Colis VARCHAR(20), Train VARCHAR(20) NULL, Destinataire VARCHAR(50), Format VARCHAR(50), QauntiteAffiches INT, JourDepart VARCHAR(50)
,Annonceur1 VARCHAR(50),Annonceur2 VARCHAR(50),Annonceur3 VARCHAR(50),Annonceur4 VARCHAR(50)
,Contrat1 INT NULL, Visuel1 VARCHAR(50) NULL, Repiquage1 VARCHAR(50) NULL
,Contrat2 INT NULL, Visuel2 VARCHAR(50) NULL, Repiquage2 VARCHAR(50) NULL
,Contrat3 INT NULL, Visuel3 VARCHAR(50) NULL, Repiquage3 VARCHAR(50) NULL
,Contrat4 INT NULL, Visuel4 VARCHAR(50) NULL, Repiquage4 VARCHAR(50) NULL
,EstTrain BIT, Afficheur VARCHAR(50) NULL, ColisId INT, Pers_Id INT)

INSERT INTO #res
(Colis ,ColisId, Train , Destinataire , Format , QauntiteAffiches , JourDepart 
,Annonceur1 ,Annonceur2 ,Annonceur3 ,Annonceur4
,Contrat1 , Visuel1 , Repiquage1
,Contrat2 , Visuel2 , Repiquage2
,Contrat3 , Visuel3 , Repiquage3
,Contrat4 , Visuel4 , Repiquage4
,Pers_Id,Afficheur, EstTrain)
SELECT
colis.colis_code as Colis,
colis.colis_id,
train.train_id as Train,
destinataire.dest_nom as Destinataire,
sup.sup_nom as 'Format',
COUNT(*) as QauntiteAffiches,
jourDepart.libelle as JourDepart,
NULL as Annonceur1,
NULL as Annonceur2,
NULL as Annonceur3,
NULL as Annonceur4,
NULL as Contrat1,
NULL as Visuel1,
NULL as Repiquage1,
NULL as Contrat2,
NULL as Visuel2,
NULL as Repiquage2,
NULL as Contrat3,
NULL as Visuel3,
NULL as Repiquage3,
NULL as Contrat4,
NULL as Visuel4,
NULL as Repiquage4,
train.pers_ident,
train.pers_nom,
1 as EstTrain
FROM 
tf_face_train train
join @idsColis ids on ids.Id = train.colis_id
join tf_colis colis on train.colis_id = colis.colis_id
join tr_destinataire destinataire on destinataire.dest_id = colis.dest_id
join tr_jour_depart jourDepart on jourDepart.jour_depart_id = train.IdJourDepart
join tr_categorie_support sup on sup.sup_id = train.sup_id
GROUP BY colis.colis_code, train.train_id, destinataire.dest_nom, jourDepart.libelle, sup.sup_nom,colis.colis_id, pers_ident,train.pers_nom


INSERT INTO #res(Colis,ColisId, Destinataire, Format, Afficheur,Contrat1, Annonceur1, Visuel1, QauntiteAffiches,Pers_Id, EstTrain)
SELECT col.colis_code,col.colis_id, destinataire.dest_nom,sup.sup_nom, um.pers_nom, um.cont_num,um.UM_annonceur, um.UM_theme, um.UM_qte,um.pers_ident, 0
FROM tf_UM um
JOIN tf_UM_colis umco on umco.UM_id = um.UM_id
join @idsColis ids on ids.Id = umco.colis_id
JOIN tf_colis col on col.colis_id = umco.colis_id
join tr_destinataire destinataire on destinataire.dest_id = col.dest_id
join tr_categorie_support sup on sup.sup_id = um.sup_id

SELECT train_id, cont_annonc, theme, repiquage, cont_num, ROW_NUMBER()  OVER(PARTITION BY train_id Order By ordre_reel) as s_index
INTO #temp
from tf_face_train train
join #res res on res.Train = train.train_id
ORDER BY ordre_reel

UPDATE res
SET Contrat1 = cont_num,
Visuel1 = theme,
Annonceur1 = cont_annonc,
Repiquage1 = repiquage
FROM #res res
join #temp t on res.Train = t.train_id
WHERE res.EstTrain = 1 and s_index = 1

UPDATE res
SET Contrat2 = cont_num,
Visuel2 = theme,
Annonceur2 = cont_annonc,
Repiquage2 = repiquage
FROM #res res
join #temp t on res.Train = t.train_id
WHERE res.EstTrain = 1 and s_index = 2

UPDATE res
SET Contrat3 = cont_num,
Visuel3 = theme,
Annonceur3 = cont_annonc,
Repiquage3 = repiquage
FROM #res res
join #temp t on res.Train = t.train_id
WHERE res.EstTrain = 1 and s_index = 3

UPDATE res
SET Contrat4 = cont_num,
Visuel4 = theme,
Annonceur4 = cont_annonc,
Repiquage4 = repiquage
FROM #res res
join #temp t on res.Train = t.train_id
WHERE res.EstTrain = 1 and s_index = 4

SELECT Colis , Train , Destinataire, Format , QauntiteAffiches , JourDepart 
,Annonceur1 ,Annonceur2 ,Annonceur3 ,Annonceur4 
,Contrat1 , Visuel1 , Repiquage1 
,Contrat2 , Visuel2 , Repiquage2 
,Contrat3 , Visuel3 , Repiquage3 
,Contrat4 , Visuel4 , Repiquage4 
,EstTrain , Afficheur , ColisId, Pers_Id
FROM #res

DROP TABLE #res
DROP TABLE #temp


END
GO
/****** Object:  StoredProcedure [dbo].[p_GetErrorInfo]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[p_GetErrorInfo]
AS
BEGIN
-- =============================================
-- Author:		Jerbi Omar
-- Create date: 18/10/2017
-- Description:	procedure to retrieve error information
-- =============================================
	SET NOCOUNT ON;

	INSERT into dbo.tt_log (log_date,log_module,log_acteur,log_desc)
    SELECT GETDATE(),'Archivage', 'Batch Archivage',
    CONCAT ('ErrorNumber: ' +  CAST(ERROR_NUMBER() AS varchar)
    , ' ErrorSeverity: ' +   CAST(ERROR_SEVERITY() AS varchar)
    , ' ErrorState: ' +  CAST(ERROR_STATE() AS varchar)  
    , ' ErrorLine: ' +   CAST(ERROR_LINE () AS varchar)
    , ' ErrorProcedure: ' +   ERROR_PROCEDURE() 
    , ' ErrorMessage: ' +   ERROR_MESSAGE()
	)

END
;
GO
/****** Object:  StoredProcedure [dbo].[P_GetGlobalColisForSend]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


CREATE Procedure [dbo].[P_GetGlobalColisForSend]
AS
BEGIN
	Declare @DateDernierMaj Date
	select @DateDernierMaj = DateMaj from Parametre_Package where Nom_Package = 'SendMailColis'
	
	CREATE TABLE #result (ColisId int, PersIdent numeric(9, 0), Afficheur varchar(50), 
	DestNom varchar(50) , QteAffiche int, QteRouleauxTrain int, CodeColis varchar(50))
	
	INSERT INTO #result (ColisId , PersIdent , Afficheur , 
	DestNom, QteAffiche , QteRouleauxTrain, CodeColis)
	select tc.colis_id, um.pers_ident, um.pers_nom, 
	dst.dest_nom, Sum(um.UM_qte) as QteAffiche, count(1) as QteRT, tc.colis_code
	from tf_UM_colis tuc  
	inner join 
		tf_colis tc on tuc.colis_id = tc.colis_id
	inner join 
		tf_UM um on um.UM_id = tuc.UM_id
	inner join
		tr_destinataire dst on um.dest_id = dst.dest_id
	where 
		--tuc.colis_id = 475265
		ISNULL(tc.Mailcolis_envoye, 0) = 0	
	and 
		tc.rpc_statut = 8
	and 
		tc.colis_dat_expe > @DateDernierMaj 	
	Group by tc.colis_id, um.pers_ident, um.pers_nom, 
	dst.dest_nom, tc.colis_code

	INSERT INTO #result (ColisId , PersIdent , Afficheur , 
	DestNom, QteAffiche , QteRouleauxTrain, CodeColis)	
	select  d.colis_id, d.pers_ident, d.pers_nom, d.dest_nom, 
	Sum(d.Nbaffiche) as QteAffiche, Sum(d.train) QteRT, d.colis_code from (
	select tc.colis_id, t.pers_ident, t.pers_nom, dst.dest_nom, t.RefPanel, COUNT(*) as Nbaffiche, 1 as train, tc.colis_code
	FROM 
		tf_face_train t
	inner join 
		tf_colis tc on t.colis_id = tc.colis_id
	inner join
		tr_destinataire dst on t.dest_id = dst.dest_id
	WHERE 
		--tc.colis_id = 475285
	ISNULL(tc.Mailcolis_envoye, 0) = 0	
	and 
		tc.rpc_statut = 8
	and 
		tc.colis_dat_expe > @DateDernierMaj 	
	Group by tc.colis_id, t.pers_ident, t.pers_nom, dst.dest_nom, t.RefPanel, tc.colis_code
	) as d
	Group by d.colis_id, d.pers_ident, d.pers_nom, d.dest_nom, d.colis_code

select * from #result
order by ColisId

END
GO
/****** Object:  StoredProcedure [dbo].[p_GetListActivite]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE  PROCEDURE [dbo].[p_GetListActivite]
	@year int,
	@week int,
	@plt_id int

AS
BEGIN
	
	SET NOCOUNT ON;
	SET FMTONLY OFF

	
DECLARE @WeekStart datetime
DECLARE @WeekEnd datetime

SELECT @WeekStart = DATEADD(wk,@week-1,DATEADD(yy,@year-1900,0))
SELECT @WeekEnd =DATEADD(wk,@week,DATEADD(yy,@year-1900,0))-3 

SELECT  act.DateProduction
       ,eq.Libelle as equipe
	   ,ma.Libelle as machine
	   ,act.IdAffiche as affiche
	   ,aff.theme
	   ,ca.sup_nom as [format]
       ,act.Quantite
       ,act.Rebus

FROM Activite act
JOIN Equipe eq on act.IdEquipe = eq.IdEquipe
JOIN Machine ma on act.IdMachine = ma.IdMachine
JOIN affiche aff on act.IdAffiche = aff.affiche_id
JOIN tr_categorie_support ca on aff.sup_id = ca.sup_id

WHERE (act.DateProduction>=@WeekStart and act.DateProduction<=@WeekEnd)
   and aff.plt_id = @plt_id

END
;
GO
/****** Object:  StoredProcedure [dbo].[p_GetListeAffiche]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[p_GetListeAffiche]
	-- Add the parameters for the stored procedure here
	@plt_id int,
	@historique bit =0,
	@debut datetime,
	@fin datetime,
	@ZonePicking bit = 0
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	SET FMTONLY OFF;

create table #result
(affiche_id int,
quantite int,
sup_nom varchar(50),
date_entree datetime,
cont_num varchar(50),
cont_annonc varchar(50),
theme varchar(50),
repiquage varchar(50),
conservation int,
date_dernier_depart datetime,
allee varchar(10),
rayon varchar(10),
date_derniere_sortie datetime,
rebus bit,
orpheline varchar(5),
validationAdmin varchar(5),
a_conserver bit,
zone_Picking bit,
date_destruction datetime,
a_recevoir bit, 
est_fusionne bit,
semaines varchar(200) null,
nombre_semaine int null,
sup_id  INT NULL,
annee INT NULL,
plt_id INT NULL,
plt_nom VARCHAR(100) NULL)

insert #result (affiche_id,quantite,sup_nom,date_entree,cont_num,cont_annonc,theme,repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,
orpheline,validationAdmin,a_conserver,zone_Picking,date_destruction,a_recevoir,est_fusionne, semaines, nombre_semaine, sup_id,annee, plt_id, plt_nom )
SELECT 
	 aff.affiche_id,
	 0 as quantite,
	 cat.sup_nom,
	 date_entree,
	 aff.cont_num,
	 cont_annonc,
	 theme,
	 aff.repiquage,
	 conservation,
	 date_dernier_depart,
	 allee,
	 rayon,
	 date_derniere_sortie,
	 rebus,
	 (case 
	   when affiche_livraison_Id is not null then 'non'
	   else 'oui'
	 END) as orpheline,
	 (case 
	   when validationAdmin is not null and validationAdmin = 1 then 'oui'
	   else 'non'
	 END) as validationAdmin,
	 a_conserver,
	 zone_Picking,
	 date_rebus,
	 null,
	 aff.est_fusionne,
	 semaines,
	 nombre_semaine,
	 case when aff.sup_id  is not null  then aff.sup_id else 0 end ,
	 case when sem_annee is not null  then sem_annee else 0 end ,
	 case when prep.plt_id  is not null  then aff.sup_id else 0 end,
	 plt.plt_nom  
FROM 
    affiche aff
	JOIN
		tr_categorie_support cat on aff.sup_id = cat.sup_id
	LEFT OUTER JOIN
		tf_prepa_affiche prep on aff.affiche_id = prep.affiche_livraison_Id
	LEFT OUTER JOIN
		mouvement mvt on aff.affiche_id = mvt.affiche_id
	Left JOIN
		fusion_affiche fusion on fusion.id_affiche = aff.affiche_id
	JOIN 
        tr_plateforme plt ON plt.plt_id = aff.plt_id
	WHERE
		 aff.plt_id = @plt_id 
		 and fusion.id_affiche is null
    GROUP BY
		 aff.affiche_id,cat.sup_nom,date_entree,aff.cont_num,cont_annonc,theme,aff.repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,
		 validationAdmin,prep.affiche_livraison_Id,a_conserver,zone_Picking,date_rebus,  aff.est_fusionne, semaines, nombre_semaine, aff.sup_id, sem_annee,
		 prep.plt_id, plt.plt_nom
--calcul quantite
select mv.affiche_id as id,SUM(mv.quantite) as somme
into #temp
from mouvement mv
group by mv.affiche_id

update r
set r.quantite = t.somme
from #result r
inner join #temp t  on t.id = r.affiche_id


if(@ZonePicking = 1)
	begin
		select * from #result 
		where zone_Picking = 1 and zone_Picking is not null
		and date_entree >= @debut and date_entree <= @fin
	end
	else
	begin
		select * from #result 
		where  date_entree >= @debut and date_entree <= @fin
	end

drop table #result
END
GO
/****** Object:  StoredProcedure [dbo].[p_GetListeAfficheATraiter]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[p_GetListeAfficheATraiter]
	-- Add the parameters for the stored procedure here
	@plt_id int,
	@historique bit =0,
	@debut datetime,
	@fin datetime,
	@ZonePicking bit = 0
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	SET FMTONLY OFF;

create table #result
(affiche_id int,
quantite int,
sup_nom varchar(50),
date_entree datetime,
cont_num varchar(50),
cont_annonc varchar(50),
theme varchar(50),
repiquage varchar(50),
conservation int,
date_dernier_depart datetime,
allee varchar(10),
rayon varchar(10),
date_derniere_sortie datetime,
rebus bit,
orpheline varchar(5),
validationAdmin varchar(5),
a_conserver bit,
zone_picking bit,
date_destruction datetime,
a_recevoir bit,
est_fusionne bit,
semaines varchar(200) null,
nombre_semaine int null)


insert #result (affiche_id,quantite,sup_nom,date_entree,cont_num,cont_annonc,theme,repiquage,conservation,date_dernier_depart,
allee,rayon,date_derniere_sortie,rebus,orpheline,validationAdmin,a_conserver,zone_picking,date_destruction,a_recevoir,est_fusionne, semaines, nombre_semaine)
SELECT 
	  aff.affiche_id,
	  0,
	  cat.sup_nom,
	  date_entree,
	  aff.cont_num,
	  cont_annonc,
	  theme,
	  aff.repiquage,
	  conservation,
	  date_dernier_depart,
	  allee,
	  rayon,
	  date_derniere_sortie,
	  rebus,
	  (case 
		   when affiche_livraison_Id is not null then 'non'
		   else 'oui'
	  END) as orpheline,
	  (case 
		   when validationAdmin is not null and validationAdmin = 1 then 'oui'
		   else 'non'
	  END) as validationAdmin,
	  a_conserver,
	  zone_Picking,
	  date_rebus,
	  null,
	  aff.est_fusionne,
	  semaines,
	  nombre_semaine
FROM 
	  affiche aff
	  JOIN
		  tr_categorie_support cat on aff.sup_id = cat.sup_id
	  LEFT OUTER JOIN
		  tf_prepa_affiche prep on aff.affiche_id = prep.affiche_livraison_Id
	  LEFT OUTER JOIN
		  mouvement mvt on aff.affiche_id = mvt.affiche_id
	  Left JOIN
		fusion_affiche fusion on fusion.id_affiche = aff.affiche_id
WHERE
	  aff.plt_id = @plt_id 
	  and ((validationAdmin is null or validationAdmin = 0) 
	  or prep.affiche_livraison_Id is null)
   	  and (rebus = 0 or rebus is null)
	  and fusion.id_affiche is null
GROUP BY
	  aff.affiche_id,cat.sup_nom,date_entree,aff.cont_num,cont_annonc,theme,aff.repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,validationAdmin,
	  prep.affiche_livraison_Id,a_conserver,zone_Picking,date_rebus,  aff.est_fusionne, semaines, nombre_semaine

--calcul quantite
select mv.affiche_id as id,SUM(mv.quantite) as somme
into #temp
from mouvement mv
group by mv.affiche_id

update r
set r.quantite = t.somme
from #result r
inner join #temp t  on t.id = r.affiche_id

if(@ZonePicking = 1)
	begin
		select * from #result 
		where zone_picking = 1 
		and date_entree >= @debut and date_entree <= @fin
	end
	else
	begin
		select * from #result 
		where  date_entree >= @debut and date_entree <= @fin
	end
drop table #result


END


GO
/****** Object:  StoredProcedure [dbo].[p_GetListeAfficheFusionnees]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[p_GetListeAfficheFusionnees]
	-- Add the parameters for the stored procedure here
	@plt_id int,
	@historique bit =0,
	@debut datetime,
	@fin datetime,
	@ZonePicking bit = 0
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	SET FMTONLY OFF;

create table #result
(affiche_id int,
quantite int,
sup_nom varchar(50),
date_entree datetime,
cont_num varchar(50),
cont_annonc varchar(50),
theme varchar(50),
repiquage varchar(50),
conservation int,
date_dernier_depart datetime,
allee varchar(10),
rayon varchar(10),
date_derniere_sortie datetime,
rebus bit,
orpheline varchar(5),
validationAdmin varchar(5),
a_conserver bit,
zone_Picking bit,
date_destruction datetime,
a_recevoir bit,
est_fusionne bit,
semaines varchar(200) null,
nombre_semaine int null)

insert #result (affiche_id,quantite,sup_nom,date_entree,cont_num,cont_annonc,theme,repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,
orpheline,validationAdmin,a_conserver,zone_Picking,date_destruction,a_recevoir,est_fusionne, semaines , nombre_semaine)
SELECT 
	 aff.affiche_id,
	 0 as quantite,
	 cat.sup_nom,
	 date_entree,
	 aff.cont_num,
	 cont_annonc,
	 theme,
	 aff.repiquage,
	 conservation,
	 date_dernier_depart,
	 allee,
	 rayon,
	 date_derniere_sortie,
	 rebus,
	 (case 
	   when affiche_livraison_Id is not null then 'non'
	   else 'oui'
	 END) as orpheline,
	 (case 
	   when validationAdmin is not null and validationAdmin = 1 then 'oui'
	   else 'non'
	 END) as validationAdmin,
	 a_conserver,
	 zone_Picking,
	 date_rebus,
	 null,
	 aff.est_fusionne,
	 semaines,
	 nombre_semaine
FROM 
    affiche aff
	JOIN
		tr_categorie_support cat on aff.sup_id = cat.sup_id
	LEFT OUTER JOIN
		tf_prepa_affiche prep on aff.affiche_id = prep.affiche_livraison_initial_Id
	LEFT OUTER JOIN
		mouvement mvt on aff.affiche_id = mvt.id_affiche_initial
	INNER JOIN 
		fusion_affiche fs on fs.id_affiche = aff.affiche_id
	WHERE
		 aff.plt_id = @plt_id 
    GROUP BY
		 aff.affiche_id,cat.sup_nom,date_entree,aff.cont_num,cont_annonc,theme,aff.repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,
		 validationAdmin,prep.affiche_livraison_Id,a_conserver,zone_Picking,date_rebus,  aff.est_fusionne, semaines,nombre_semaine


--calcul quantite
select mv.affiche_id as id,SUM(mv.quantite) as somme
into #temp
from mouvement mv
group by mv.affiche_id

update r
set r.quantite = t.somme
from #result r
inner join #temp t  on t.id = r.affiche_id


if(@ZonePicking = 1)
	begin
		select * from #result 
		where zone_Picking = 1 and zone_Picking is not null
		and date_entree >= @debut and date_entree <= @fin
	end
	else
	begin
		select * from #result 
		where  date_entree >= @debut and date_entree <= @fin
	     and (zone_Picking = 0 or zone_Picking is null)
	end

drop table #result
END

GO
/****** Object:  StoredProcedure [dbo].[p_GetListeAfficheParDossierReservation]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[p_GetListeAfficheParDossierReservation]
	@Annee int
AS
BEGIN
    SET NOCOUNT ON;
    SET FMTONLY OFF;

    CREATE TABLE #result (
        affiche_id INT,
        quantite INT,
        sup_nom VARCHAR(50),
        date_entree DATETIME,
        cont_num VARCHAR(50),
        cont_annonc VARCHAR(50),
        theme VARCHAR(50),
        repiquage VARCHAR(50),
        conservation INT,
        date_dernier_depart DATETIME,
        allee VARCHAR(10),
        rayon VARCHAR(10),
        date_derniere_sortie DATETIME,
        rebus BIT,
        orpheline VARCHAR(5),
        validationAdmin VARCHAR(5),
        a_conserver BIT,
        zone_Picking BIT,
        date_destruction DATETIME,
        a_recevoir BIT, 
        est_fusionne BIT,
        semaines VARCHAR(200) NULL,
        nombre_semaine INT NULL,
		sup_id  INT NULL,
		sem_num INT NULL,
		annee INT NULL,
		plt_id INT NULL,
		plt_nom VARCHAR(100) NULL
    );

    INSERT INTO #result (
        affiche_id, quantite, sup_nom, date_entree, cont_num, cont_annonc, theme, repiquage, 
        conservation, date_dernier_depart, allee, rayon, date_derniere_sortie, rebus,
        orpheline, validationAdmin, a_conserver, zone_Picking, date_destruction, a_recevoir, 
        est_fusionne, semaines, nombre_semaine, sup_id, sem_num,annee, plt_id, plt_nom
    )
    SELECT 
        aff.affiche_id,
        0 AS quantite,
        cat.sup_nom,
        date_entree,
        aff.cont_num,
        cont_annonc,
        theme,
        aff.repiquage,
        conservation,
        date_dernier_depart,
        allee,
        rayon,
        date_derniere_sortie,
        rebus,
        CASE 
            WHEN affiche_livraison_Id IS NOT NULL THEN 'non'
            ELSE 'oui'
        END AS orpheline,
        CASE 
            WHEN validationAdmin IS NOT NULL AND validationAdmin = 1 THEN 'oui'
            ELSE 'non'
        END AS validationAdmin,
        a_conserver,
        zone_Picking,
        date_rebus,
        NULL,
        aff.est_fusionne,
        semaines,
        nombre_semaine,
		aff.sup_id,
		sem_num,
		sem_annee,
		prep.plt_id,
		plt.plt_nom
    FROM 
        affiche aff
    JOIN
        tr_categorie_support cat ON aff.sup_id = cat.sup_id
    LEFT OUTER JOIN
        tf_prepa_affiche prep ON aff.affiche_id = prep.affiche_livraison_Id
    LEFT OUTER JOIN
        mouvement mvt ON aff.affiche_id = mvt.affiche_id
    LEFT JOIN
        fusion_affiche fusion ON fusion.id_affiche = aff.affiche_id
    JOIN 
        tr_plateforme plt ON plt.plt_id = aff.plt_id
    WHERE
         fusion.id_affiche IS NULL AND aff.cont_num is not null AND prep.sem_num is not null and sem_annee >=  @Annee
    GROUP BY
        aff.affiche_id, cat.sup_nom, date_entree, aff.cont_num, cont_annonc, theme, aff.repiquage, 
        conservation, date_dernier_depart, allee, rayon, date_derniere_sortie, rebus, 
        validationAdmin, prep.affiche_livraison_Id, a_conserver, zone_Picking, date_rebus, 
        aff.est_fusionne, semaines, nombre_semaine, aff.sup_id,sem_num,sem_annee,prep.plt_id,plt.plt_nom;

    -- Calculate quantity
    SELECT mv.affiche_id AS id, SUM(mv.quantite) AS somme
    INTO #temp
    FROM mouvement mv
    GROUP BY mv.affiche_id;

    UPDATE r
    SET r.quantite = t.somme
    FROM #result r
    INNER JOIN #temp t ON t.id = r.affiche_id;

    SELECT * FROM #result;

    DROP TABLE #result;
END
GO
/****** Object:  StoredProcedure [dbo].[p_GetListeAfficheRebus]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[p_GetListeAfficheRebus]
	-- Add the parameters for the stored procedure here
	@plt_id int,
	@historique bit =0,
	@debut datetime,
	@fin datetime,
	@ZonePicking bit = 0
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	SET FMTONLY OFF;

create table #result
(affiche_id int,
quantite int,
sup_nom varchar(50),
date_entree datetime,
cont_num varchar(50),
cont_annonc varchar(50),
theme varchar(50),
repiquage varchar(50),
conservation int,
date_dernier_depart datetime,
allee varchar(10),
rayon varchar(10),
date_derniere_sortie datetime,
rebus bit,
orpheline varchar(5),
validationAdmin varchar(5),
a_conserver bit,
zone_Picking bit,
date_destruction datetime,
a_recevoir bit,
est_fusionne bit,
semaines varchar(200) null,
nombre_semaine int null)

insert #result (affiche_id,quantite,sup_nom,date_entree,cont_num,cont_annonc,theme,repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,
orpheline,validationAdmin,a_conserver,zone_Picking,date_destruction,a_recevoir,est_fusionne, semaines, nombre_semaine)
SELECT 
	 aff.affiche_id,
	 0 as quantite,
	 cat.sup_nom,
	 date_entree,
	 aff.cont_num,
	 cont_annonc,
	 theme,
	 aff.repiquage,
	 conservation,
	 date_dernier_depart,
	 allee,
	 rayon,
	 date_derniere_sortie,
	 rebus,
	 (case 
	   when affiche_livraison_Id is not null then 'non'
	   else 'oui'
	 END) as orpheline,
	 (case 
	   when validationAdmin is not null and validationAdmin = 1 then 'oui'
	   else 'non'
	 END) as validationAdmin,
	 a_conserver,
	 zone_Picking,
	 date_rebus,
	 null,
	 aff.est_fusionne,
	 semaines, 
	 nombre_semaine
FROM 
    affiche aff
	JOIN
		tr_categorie_support cat on aff.sup_id = cat.sup_id
	LEFT OUTER JOIN
		tf_prepa_affiche prep on aff.affiche_id = prep.affiche_livraison_Id
	LEFT OUTER JOIN
		mouvement mvt on aff.affiche_id = mvt.affiche_id
	Left JOIN
		fusion_affiche fusion on fusion.id_affiche = aff.affiche_id
	WHERE
		 aff.plt_id = @plt_id 
		 and (aff.rebus = 1)
		 and fusion.id_affiche is null

    GROUP BY
		 aff.affiche_id,cat.sup_nom,date_entree,aff.cont_num,cont_annonc,theme,aff.repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,
		 validationAdmin,prep.affiche_livraison_Id,a_conserver,zone_Picking,date_rebus,  aff.est_fusionne, semaines, nombre_semaine


--calcul quantite
select mv.affiche_id as id,SUM(mv.quantite) as somme
into #temp
from mouvement mv
group by mv.affiche_id

update r
set r.quantite = t.somme
from #result r
inner join #temp t  on t.id = r.affiche_id


if(@ZonePicking = 1)
	begin
		select * from #result 
		where zone_Picking = 1 and zone_Picking is not null
		and date_entree >= @debut and date_entree <= @fin
	end
	else
	begin
		select * from #result 
		where  date_entree >= @debut and date_entree <= @fin
	     and (zone_Picking = 0 or zone_Picking is null)
	end

drop table #result
END

GO
/****** Object:  StoredProcedure [dbo].[p_GetListeReceptionAffiche]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[p_GetListeReceptionAffiche]
	-- Add the parameters for the stored procedure here
	@ZonePicking bit = 0,
	@plt_id int,
	@historique bit =0,
	@debut datetime,
	@fin datetime,
	@resultatSelected int

AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
-- afficher tous les résultat
create table #result
(affiche_id int,
quantite int,
sup_nom varchar(50),
date_entree datetime,
cont_num varchar(50),
cont_annonc varchar(50),
theme varchar(50),
repiquage varchar(50),
conservation int,
date_dernier_depart datetime,
allee varchar(10),
rayon varchar(10),
date_derniere_sortie datetime,
rebus bit,
orpheline varchar(5),
validationAdmin varchar(5),
a_conserver bit,
est_fusionne bit null)


 IF(@resultatSelected = 0)
  BEGIN
	IF(@ZonePicking = 0)
	 BEGIN
	 IF(@historique = 1)
	  BEGIN
	  insert #result (affiche_id,quantite,sup_nom,date_entree,cont_num,cont_annonc,theme,repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,orpheline,validationAdmin,a_conserver, est_fusionne)
	    SELECT 
		 aff.affiche_id,0 as quantite,cat.sup_nom,date_entree,aff.cont_num,cont_annonc,theme,aff.repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,
		  (case 
		   when affiche_livraison_Id is not null then 'non'
		   else 'oui'
		 END) as orpheline,
		 (case 
		   when validationAdmin is not null and validationAdmin = 1 then 'oui'
		   else 'non'
		 END) as validationAdmin,
		 a_conserver,
		 est_fusionne
		FROM 
		 affiche aff
		JOIN
		 tr_categorie_support cat on aff.sup_id = cat.sup_id
		LEFT OUTER JOIN
		 tf_prepa_affiche prep on aff.affiche_id = prep.affiche_livraison_Id
		LEFT OUTER JOIN
		 mouvement mvt on aff.affiche_id = mvt.affiche_id
		WHERE
		 aff.plt_id = @plt_id 
		 and date_entree >= @debut and date_entree <= @fin
	     and (zone_Picking = @ZonePicking or zone_Picking is null)
        GROUP BY
		 aff.affiche_id,cat.sup_nom,date_entree,aff.cont_num,cont_annonc,theme,aff.repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,validationAdmin,prep.affiche_livraison_Id,a_conserver,est_fusionne

	  END
     ELSE
	  BEGIN
	  insert #result (affiche_id,quantite,sup_nom,date_entree,cont_num,cont_annonc,theme,repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,orpheline,validationAdmin,a_conserver,est_fusionne)
	   SELECT aff.affiche_id,0 as quantite,cat.sup_nom,date_entree,aff.cont_num,cont_annonc,theme,aff.repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,
	     (case 
		   when affiche_livraison_Id is not null then 'non'
		   else 'oui'
		 END) as orpheline,
		 (case 
		   when validationAdmin is not null and validationAdmin = 1 then 'oui'
		   else 'non'
		 END) as validationAdmin,
		 a_conserver,
		 est_fusionne
		FROM 
		 affiche aff
		JOIN
		 tr_categorie_support cat on aff.sup_id = cat.sup_id
		LEFT OUTER JOIN
		 tf_prepa_affiche prep on aff.affiche_id = prep.affiche_livraison_Id
		LEFT OUTER JOIN
		 mouvement mvt on aff.affiche_id = mvt.affiche_id
		WHERE
		 aff.plt_id = @plt_id 
		 and rebus >= 0 and rebus is null
	     and (zone_Picking = @ZonePicking or zone_Picking is null)
		GROUP BY
		 aff.affiche_id,cat.sup_nom,date_entree,aff.cont_num,cont_annonc,theme,aff.repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,validationAdmin,prep.affiche_livraison_Id,a_conserver,est_fusionne

       END
	 END
	  ELSE
	   BEGIN
	    IF(@historique = 1)
	  BEGIN
	  insert #result (affiche_id,quantite,sup_nom,date_entree,cont_num,cont_annonc,theme,repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,orpheline,validationAdmin,a_conserver,est_fusionne)
	    SELECT 
		 aff.affiche_id,0,cat.sup_nom,date_entree,aff.cont_num,cont_annonc,theme,aff.repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,
		 (case 
		   when affiche_livraison_Id is not null then 'non'
		   else 'oui'
		 END) as orpheline,
		 (case 
		   when validationAdmin is not null and validationAdmin = 1 then 'oui'
		   else 'non'
		 END) as validationAdmin,
		 a_conserver,
		 est_fusionne
		FROM 
		 affiche aff
		JOIN
		 tr_categorie_support cat on aff.sup_id = cat.sup_id
		LEFT OUTER JOIN
		 tf_prepa_affiche prep on aff.affiche_id = prep.affiche_livraison_Id
		LEFT OUTER JOIN
		 mouvement mvt on aff.affiche_id = mvt.affiche_id
		WHERE
		 aff.plt_id = @plt_id 
		 and date_entree >= @debut and date_entree <= @fin
	     and (zone_Picking = @ZonePicking and zone_Picking is not null)
        GROUP BY
		 aff.affiche_id,cat.sup_nom,date_entree,aff.cont_num,cont_annonc,theme,aff.repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,validationAdmin,prep.affiche_livraison_Id,a_conserver,est_fusionne

	  END
     ELSE
	   BEGIN
	  insert #result (affiche_id,quantite,sup_nom,date_entree,cont_num,cont_annonc,theme,repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,orpheline,validationAdmin,a_conserver,est_fusionne)
	   SELECT aff.affiche_id,0,cat.sup_nom,date_entree,aff.cont_num,cont_annonc,theme,aff.repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,
	   (case 
		   when affiche_livraison_Id is not null then 'non'
		   else 'oui'
		 END) as orpheline,
		 (case 
		   when validationAdmin is not null and validationAdmin = 1 then 'oui'
		   else 'non'
		 END) as validationAdmin,
		 a_conserver,
		 est_fusionne
		FROM 
		 affiche aff
		JOIN
		 tr_categorie_support cat on aff.sup_id = cat.sup_id
		LEFT OUTER JOIN
		 tf_prepa_affiche prep on aff.affiche_id = prep.affiche_livraison_Id
		LEFT OUTER JOIN
		 mouvement mvt on aff.affiche_id = mvt.affiche_id
		WHERE
		 aff.plt_id = @plt_id 
		 and rebus >= 0 and rebus is null
	     and (zone_Picking = @ZonePicking and zone_Picking is not null)
		GROUP BY
		 aff.affiche_id,cat.sup_nom,date_entree,aff.cont_num,cont_annonc,theme,aff.repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,validationAdmin,prep.affiche_livraison_Id,a_conserver,est_fusionne

       END


	   END
	  
  END  
  -- afficher les orphelines et les non validées admin
   else 
  IF(@ZonePicking = 0)
	 BEGIN
	 IF(@historique = 1)
	  BEGIN
	  insert #result (affiche_id,quantite,sup_nom,date_entree,cont_num,cont_annonc,theme,repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,orpheline,validationAdmin,a_conserver, est_fusionne)
	    SELECT 
		 aff.affiche_id,0,cat.sup_nom,date_entree,aff.cont_num,cont_annonc,theme,aff.repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,
		  (case 
		   when affiche_livraison_Id is not null then 'non'
		   else 'oui'
		 END) as orpheline,
		 (case 
		   when validationAdmin is not null and validationAdmin = 1 then 'oui'
		   else 'non'
		 END) as validationAdmin,
		 a_conserver,
		 est_fusionne
		FROM 
		 affiche aff
		JOIN
		 tr_categorie_support cat on aff.sup_id = cat.sup_id
		LEFT OUTER JOIN
		 tf_prepa_affiche prep on aff.affiche_id = prep.affiche_livraison_Id
		LEFT OUTER JOIN
		 mouvement mvt on aff.affiche_id = mvt.affiche_id
		WHERE
		 aff.plt_id = @plt_id 
		 and date_entree >= @debut and date_entree <= @fin
	     and (zone_Picking = @ZonePicking or zone_Picking is null)
		 and ((validationAdmin is null or validationAdmin = 0) or prep.affiche_livraison_Id is null )
        GROUP BY
		 aff.affiche_id,cat.sup_nom,date_entree,aff.cont_num,cont_annonc,theme,aff.repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,validationAdmin,prep.affiche_livraison_Id,a_conserver,est_fusionne

	  END
     ELSE
	  BEGIN
	  insert #result (affiche_id,quantite,sup_nom,date_entree,cont_num,cont_annonc,theme,repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,orpheline,validationAdmin,a_conserver,est_fusionne)
	   SELECT aff.affiche_id,0,cat.sup_nom,date_entree,aff.cont_num,cont_annonc,theme,aff.repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,
	     (case 
		   when affiche_livraison_Id is not null then 'non'
		   else 'oui'
		 END) as orpheline,
		 (case 
		   when validationAdmin is not null and validationAdmin = 1 then 'oui'
		   else 'non'
		 END) as validationAdmin,
		 a_conserver,
		 est_fusionne
		FROM 
		 affiche aff
		JOIN
		 tr_categorie_support cat on aff.sup_id = cat.sup_id
		LEFT OUTER JOIN
		 tf_prepa_affiche prep on aff.affiche_id = prep.affiche_livraison_Id
		LEFT OUTER JOIN
		 mouvement mvt on aff.affiche_id = mvt.affiche_id
		WHERE
		 aff.plt_id = @plt_id 
		 and rebus >= 0 and rebus is null
	     and (zone_Picking = @ZonePicking or zone_Picking is null)
		  and ((validationAdmin is null or validationAdmin = 0) or prep.affiche_livraison_Id is null )
		GROUP BY
		 aff.affiche_id,cat.sup_nom,date_entree,aff.cont_num,cont_annonc,theme,aff.repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,validationAdmin,prep.affiche_livraison_Id,a_conserver,est_fusionne

       END
	 END
	  ELSE
	   BEGIN
	    IF(@historique = 1)
	  BEGIN
	  insert #result (affiche_id,quantite,sup_nom,date_entree,cont_num,cont_annonc,theme,repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,orpheline,validationAdmin,a_conserver,est_fusionne)
	    SELECT 
		 aff.affiche_id,0,cat.sup_nom,date_entree,aff.cont_num,cont_annonc,theme,aff.repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,
		 (case 
		   when affiche_livraison_Id is not null then 'non'
		   else 'oui'
		 END) as orpheline,
		 (case 
		   when validationAdmin is not null and validationAdmin = 1 then 'oui'
		   else 'non'
		 END) as validationAdmin,
		 a_conserver,
		 est_fusionne
		FROM 
		 affiche aff
		JOIN
		 tr_categorie_support cat on aff.sup_id = cat.sup_id
		LEFT OUTER JOIN
		 tf_prepa_affiche prep on aff.affiche_id = prep.affiche_livraison_Id
		LEFT OUTER JOIN
		 mouvement mvt on aff.affiche_id = mvt.affiche_id
		WHERE
		 aff.plt_id = @plt_id 
		 and date_entree >= @debut and date_entree <= @fin
	     and (zone_Picking = @ZonePicking and zone_Picking is not null)
		  and ((validationAdmin is null or validationAdmin = 0) or prep.affiche_livraison_Id is null )
        GROUP BY
		 aff.affiche_id,cat.sup_nom,date_entree,aff.cont_num,cont_annonc,theme,aff.repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,validationAdmin,prep.affiche_livraison_Id,a_conserver,est_fusionne

	  END
     ELSE
	   BEGIN
	  insert #result (affiche_id,quantite,sup_nom,date_entree,cont_num,cont_annonc,theme,repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,orpheline,validationAdmin,a_conserver,est_fusionne)
	   SELECT aff.affiche_id,0,cat.sup_nom,date_entree,aff.cont_num,cont_annonc,theme,aff.repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,
	   (case 
		   when affiche_livraison_Id is not null then 'non'
		   else 'oui'
		 END) as orpheline,
		 (case 
		   when validationAdmin is not null and validationAdmin = 1 then 'oui'
		   else 'non'
		 END) as validationAdmin,
		 a_conserver,
		 est_fusionne
		FROM 
		 affiche aff
		JOIN
		 tr_categorie_support cat on aff.sup_id = cat.sup_id
		LEFT OUTER JOIN
		 tf_prepa_affiche prep on aff.affiche_id = prep.affiche_livraison_Id
		LEFT OUTER JOIN
		 mouvement mvt on aff.affiche_id = mvt.affiche_id
		WHERE
		 aff.plt_id = @plt_id 
		 and rebus >= 0 and rebus is null
	     and (zone_Picking = @ZonePicking and zone_Picking is not null)
		 and ((validationAdmin is null or validationAdmin = 0) or prep.affiche_livraison_Id is null )
		GROUP BY
		 aff.affiche_id,cat.sup_nom,date_entree,aff.cont_num,cont_annonc,theme,aff.repiquage,conservation,date_dernier_depart,allee,rayon,date_derniere_sortie,rebus,validationAdmin,prep.affiche_livraison_Id,a_conserver,est_fusionne

       END


	   END
	   --calcul quantite
	   select mv.affiche_id as id,SUM(mv.quantite) as somme
		 into #temp
		 from mouvement mv
		 group by mv.affiche_id

		update r
		 set r.quantite = t.somme
		 from #result r
		inner join #temp t  on t.id = r.affiche_id

	   select * from #result
	   drop table #result
	 return 0
END
;;;;;
GO
/****** Object:  StoredProcedure [dbo].[p_GetListTrain]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[p_GetListTrain]
	@numsemaine		varchar(2),
	@numannee		varchar(4),
    @ate_id         smallint,
	@user           varchar(150)
AS
BEGIN
	
	SET NOCOUNT ON;
	SET FMTONLY OFF;
	SET LANGUAGE French


	 SELECT 
	  ft.train_id,
	  dest.dest_nom as destinataire,
	  0 as quantite,
	  count(ft.cadre_lib) as nbreFace,
	  rou.rouleur_nom as rouleur,
	  st.statut_nom as statut,
	  ft.rdep_datdep as dateDepart,
	  datename(dw,ft.rdep_datdep) as dateDepartDay

	INTO 
	  #ListTrainTemp

	FROM 
	  tf_face_train ft
      JOIN tr_statut st ON (ft.rpc_statut = st.rpc_statut)
      JOIN tr_destinataire dest ON (ft.dest_id= dest.dest_id)
      JOIN tr_utilisateur_data users ON (ft.ate_id = users.ate_id)
      JOIN tr_rouleur rou ON (ft.rouleur_id = rou.rouleur_id)
	
    WHERE
           ft.dep_anbas	= @numannee
       and ft.dep_sembas= @numsemaine
       and users.loginWindows = @user
       and ft.ate_id = @ate_id
	   and ft.train_id is not null
	   and ft.rpc_statut<> 4 

	GROUP BY
	  ft.train_id,
	  rou.rouleur_nom,
	  st.statut_nom,
	  ft.rdep_datdep,
	  dest.dest_nom


	SELECT
	  temp.destinataire,
	  count(temp.train_id) as quantite,
	  temp.nbreFace,
	  temp.rouleur,
	  max(temp.statut) as statut,
	  max(temp.dateDepart) as dateDepart,
	  max(temp.dateDepartDay) as dateDepartDay
	 
	FROM
	 #ListTrainTemp temp

	GROUP BY 
	  temp.destinataire,
	  temp.nbreFace,
	  --temp.train_id,
	  temp.rouleur--,
	  --temp.statut,
	  --temp.dateDepart,
	  --temp.dateDepartDay

	 ORDER BY
	  destinataire
	    
	DROP table #ListTrainTemp  

END
;
GO
/****** Object:  StoredProcedure [dbo].[p_GetPrepareListAffiches]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO



-- =============================================
-- Author:		Jerbi Omar
-- Create date: 29/11/2018
-- Description: préparation liste des affiches --> affiche a recevoir
-- =============================================
CREATE PROCEDURE [dbo].[p_GetPrepareListAffiches]
	-- Add the parameters for the stored procedure here
	 @dateDebut datetime = NULL,
	 @dateFin datetime = NULL,
	 @debut int = NULL,
	 @fin int = NULL,
	 @anneeDebut int = NULL,
	 @anneeFin int = NULL,
	 @plt_id int,
     @isLivraison bit = false
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	SET FMTONLY OFF

   create table #result
	(
	[NumeroLivraison] [int] NULL, 
	[DateLivraison] [datetime] NULL,
	[Dossier] [int] NULL,
	[Annonceur] [varchar](250) NULL,
	[Description] [varchar](255) NULL,
	[theme] [varchar](250) NULL,
	[QteTheo] [int] NULL,
	[QteRec]  [int] NULL,
	[Format] [varchar](50) NULL,
	[tf_prepa_affiche_Id] [int] NULL,
	[affiche_id] [int] NULL,
	[plt_id] [int] NULL,
	[sup_id] [int] NULL,
	[LivraisonId] [int] NULL,
	[affiche_livraison_Id] [int] NULL,
	[FromBroadcast] bit NULL,
	[ARecevoir] bit NULL,
	[IdDAChapeau] [int] NULL,
	[repiquage] [varchar](100) NULL,
	[sem_num] [int] NULL,
	[sem_annee] [int] NULL
	)
  
   CREATE table #tempTf_prepa_affiche (
    [RowID] int not null primary key identity(1,1),
	[Id] [int] NOT NULL, 
	[LivraisonId] int null,
	[NumeroLivraison] [int] NULL, 
	[DateLivraison] [datetime] NULL,
	[plt_id] [int] NULL,
	[sup_id] [int] NULL,
	[cont_num] [int] NULL,
	[Format] [varchar](50) NULL,
	[Description] [varchar](255) NULL,
	[rpc_annonceur] [varchar](100) NULL,
	[rpc_num_aff_amt] [int] NULL,
	[rpc_theme] [varchar](50) NULL,
	[Statut] [varchar](50) NULL,
	[Qte_Theorique] [int] NULL,
	[sem_num] [int] NULL,
	[sem_annee] [int] NULL,
	[affiche_livraison_Id] [int] NULL,
	[FromBroadcast] [bit] NULL,
	[ARecevoir] [bit] NULL,
	[dateCreated] [datetime] NULL,
	[dateModified] [datetime] NULL,
	[repiquage] [varchar](50) NULL,
	[IdDAChapeau] [int] NULL
	)

	
	 insert into #tempTf_prepa_affiche ([Id],
	[LivraisonId],
	[NumeroLivraison], 
	[DateLivraison],
	[plt_id],
	[sup_id],
	[cont_num],
	[Format],
	[Description],
	[rpc_annonceur],
	[rpc_num_aff_amt],
	[rpc_theme],
	[Statut],
	[Qte_Theorique],
	[sem_num] ,
	[sem_annee] ,
	[affiche_livraison_Id],
	[FromBroadcast],
	[ARecevoir],
	[dateCreated],
	[dateModified],
	[repiquage],
	[IdDAChapeau])
	 SELECT * from dbo.Fn_GetPrepaAffiche(@dateDebut,@dateFin,@debut,@fin,@anneeDebut,@anneeFin ,@plt_id ,@isLivraison)
	
	UPDATE 
	 #tempTf_prepa_affiche
	 set Format = '2m2'
	 where Format = '2m2 Scrolling' or Format = '2m2 Venusial'

    INSERT INTO #result(
     [NumeroLivraison] , 
	 [DateLivraison] ,
	 [Dossier] ,
	 [Annonceur],
	 [Description] ,
	 [theme] ,
	 [QteTheo] ,
	 [QteRec] ,
	 [Format],
	 [tf_prepa_affiche_Id],
	 [affiche_id],
	 [plt_id],
	 [sup_id],
	 [LivraisonId],
	 [affiche_livraison_Id],
	 [FromBroadcast],
	 [ARecevoir],
	 [IdDAChapeau],
	 [repiquage],
	 [sem_num],
	 [sem_annee]
   )
	SELECT
     NumeroLivraison,
	 MAX(DateLivraison) DateLivraison,
	 cont_num,
	 rpc_annonceur,
	 MAX([Description]) [Description],
	 rpc_theme,
	 SUM(distinct Qte_Theorique) Qte_Theorique,
	 SUM(distinct mvt.quantite) quantite,
	 [Format],
	 MAX(Id) Id,
	 MAX(affiche_livraison_Id) affiche_livraison_Id,
	 MAX(plt_id) plt_id,
	 MAX(sup_id) sup_id,
	 MAX(LivraisonId) LivraisonId,
	 MAX(affiche_livraison_Id) affiche_livraison_Id,
	 Count(NULLIF(FromBroadcast,0)),
	 count(NULLIF(ARecevoir,0)),
	 MAX(IdDAChapeau) IdDAChapeau,
	 MAX(repiquage) repiquage,
	 sem_num,
	 sem_annee
   FROM 
     #tempTf_prepa_affiche temp
   LEFT JOIN
     mouvement mvt on temp.affiche_livraison_Id = mvt.affiche_id
   GROUP BY
    NumeroLivraison,cont_num, [Format],rpc_theme,rpc_annonceur,sem_num,sem_annee
   ORDER BY
    cont_num


  SELECT * from #result ORDER BY Dossier

  DROP TABLE #result
  DROP TABLE #tempTf_prepa_affiche
 
END



;;
GO
/****** Object:  StoredProcedure [dbo].[p_GetPrepareListLivraison]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


-- =============================================
-- Author:		Jerbi Omar
-- Create date: 04/12/2018
-- Description:	préparation liste des affiches --> reception
-- =============================================
CREATE PROCEDURE [dbo].[p_GetPrepareListLivraison]
	-- Add the parameters for the stored procedure here
	 @dateDebut datetime = NULL,
	 @dateFin datetime = NULL,
	 @debut int = NULL,
	 @fin int = NULL,
	 @anneeDebut int = NULL,
	 @anneeFin int = NULL,
	 @plt_id int,
	 @isLivraison bit = false

AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	SET FMTONLY OFF

	
	CREATE TABLE #ListAfficheSansTf_prepa
	(
	[affiche_id] [int] NULL,
	[Dossier] [varchar](50) NULL,
	[LivraisonId] [int] NULL,
	[NumeroLivraison] [int] NULL, 
	[DateLivraison] [datetime] NULL,
	[Annonceur] [varchar](250) NULL,
	[Description] [varchar](255) NULL,
	[QteTheo] [int] NULL,
	[QteRec]  [int] NULL,
	[theme] [varchar](250) NULL,
	[Format] [varchar](50) NULL,
	[imprimeur] [varchar](50) NULL,
	[transporteur] [varchar](50) NULL,
	[BL_livraison] [varchar](50) NULL,
	[sem_num] [int] NULL,
	[sem_annee] [int] NULL
	)
	
	CREATE TABLE #ListAfficheFiltred
	(
	[NumeroLivraison] [int] NULL, 
	[DateLivraison] [datetime] NULL,
	[Dossier] [varchar](50) NULL,
	[Annonceur] [varchar](250) NULL,
	[Description] [varchar](255) NULL,
	[theme] [varchar](250) NULL,
	[QteTheo] [int] NULL,
	[QteRec]  [int] NULL,
	[Format] [varchar](50) NULL,
	[tf_prepa_affiche_Id] [int] NULL,
	[affiche_id] [int] NULL,
	[plt_id] [int] NULL,
	[sup_id] [int] NULL,
	[LivraisonId] [int] NULL,
	[affiche_livraison_Id] [int] NULL,
	[FromBroadcast] bit NULL,
	[ARecevoir] bit NULL,
	[IdDAChapeau] [int] NULL,
	[repiquage] [varchar](100) NULL,
	[sem_num] [int] NULL,
	[sem_annee] [int] NULL
	)
	CREATE TABLE #ListAfficheOrpheline
	(
	  [affiche_id] int NULL,
	  [Format] [varchar](50) NULL,
	  [plt_id] [int] NULL,
	  [sup_id] [int] NULL,
	  [QteTheo] [int] NULL,
	  [theme] [varchar](250) NULL,
	  [Annonceur] [varchar](250) NULL,
	  [QteRec]  [int] NULL,
	  [LivraisonId] [int] NULL,
	  [DateLivraison] [datetime] NULL,
	  [NumeroLivraison] [int] NULL, 
	  [Description] [varchar](255) NULL,
	  [Dossier] [varchar](50) NULL,
	)
  

  INSERT INTO #ListAfficheFiltred(
    [NumeroLivraison] , 
	[DateLivraison] ,
	[Dossier] ,
	[Annonceur],
	[Description] ,
	[theme] ,
	[QteTheo] ,
	[QteRec] ,
	[Format],
	[tf_prepa_affiche_Id],
	[affiche_id],
	[plt_id],
	[sup_id],
	[LivraisonId],
	[affiche_livraison_Id],
	[FromBroadcast],
	[ARecevoir],
	[IdDAChapeau],
	[repiquage],
	[sem_num],
	[sem_annee]
   )
	exec [dbo].[p_GetPrepareListAffiches] @dateDebut,@dateFin,@debut,@fin,@anneeDebut,@anneeFin ,@plt_id ,1

	INSERT INTO #ListAfficheOrpheline(
      [affiche_id] ,
	  [Format] ,
	  [plt_id],
	  [sup_id],
	  [QteTheo] ,
	  [theme] ,
	  [Annonceur] ,
	  [QteRec] ,
	  [LivraisonId] ,
	  [DateLivraison],
	  [NumeroLivraison] , 
	  [Description],
	  [Dossier]
   )
	exec [dbo].[p_GetDataReceptionOrpheline] @dateDebut,@dateFin,@plt_id


	 INSERT INTO #ListAfficheFiltred(
    [NumeroLivraison] , 
	[DateLivraison] ,
	[Dossier] ,
	[Annonceur],
	[Description] ,
	[theme] ,
	[QteTheo] ,
	[QteRec] ,
	[Format],
	[tf_prepa_affiche_Id],
	[affiche_id],
	[plt_id],
	[sup_id],
	[LivraisonId],
	[affiche_livraison_Id],
	[FromBroadcast],
	[ARecevoir],
	[IdDAChapeau],
	[repiquage],
	[sem_num],
	[sem_annee]
   )
	 select
	  [NumeroLivraison] , 
	  [DateLivraison] ,
	  [Dossier] ,
	  [Annonceur],
	  [Description] ,
	  [theme] ,
	  [QteTheo] ,
	  [QteRec] ,
	  [Format],
	  NULL,
	  [affiche_id],
	  [plt_id],
	  [sup_id],
	  [LivraisonId],
	  [affiche_id],
	  NULL,
	  NULL,
	  NULL,
	  NULL,
	  NULL,
	  NULL
	 from
	  #ListAfficheOrpheline


	 INSERT INTO #ListAfficheSansTf_prepa
	(
	[affiche_id] ,
	[Dossier] ,
	[LivraisonId] ,
	[NumeroLivraison] , 
	[DateLivraison] ,
	[Annonceur] ,
	[Description],
	[QteTheo],
	[QteRec],
	[theme],
	[Format],
	[imprimeur],
	[transporteur],
	[BL_livraison],
	[sem_num],
	[sem_annee]
	)
	SELECT
	 aff.affiche_id,
	 aff.cont_num,
	 lstAff.LivraisonId,
	 lstAff.LivraisonId,
	 liv.DateLivraison,
	 aff.cont_annonc,
	 aff.commentaire,
	 lstAff.QteTheo,
	 --SUM(mvt.quantite),
	 mvt.quantite,
	 aff.theme,
	 lstAff.Format,
	 liv.Imprimeur,
	 liv.Expediteur,
	 liv.Reference,
	 lstAff.sem_num,
	 lstAff.sem_annee
	FROM
	 #ListAfficheFiltred lstAff
	JOIN
	 affiche aff on lstAff.affiche_id = aff.affiche_id
	JOIN
	 livraison liv on liv.Id = lstAff.LivraisonId
    LEFT JOIN
	 mouvement mvt on aff.affiche_id= mvt.affiche_id and liv.Id = mvt.livraison_id
	GROUP BY
	 aff.affiche_id,
	 aff.cont_num,
	 lstAff.LivraisonId,
	 lstAff.LivraisonId,
	 liv.DateLivraison,
	 aff.cont_annonc,
	 aff.commentaire,
	 lstAff.QteTheo,
	 aff.theme,
	 lstAff.Format,
	 liv.Imprimeur,
	 liv.Expediteur,
	 liv.Reference,
	 mvt.quantite,
	 lstAff.sem_num,
	 lstAff.sem_annee



	SELECT DISTINCT
	 assoc.Id_affiche_livraison as afficheId,
	 assoc.Id_livraison
	INTO
	 #ListAfficheId
	FROM
	 #ListAfficheFiltred lstAff
    JOIN
	 asso_livraison_affiche assoc on lstAff.LivraisonId = assoc.Id_livraison
	

	 INSERT INTO #ListAfficheSansTf_prepa
	(
	[affiche_id] ,
	[Dossier] ,
	[LivraisonId] ,
	[NumeroLivraison] , 
	[DateLivraison] ,
	[Annonceur] ,
	[Description],
	[QteTheo],
	[QteRec],
	[theme],
	[Format],
	[imprimeur],
	[transporteur],
	[BL_livraison],
	[sem_num],
	[sem_annee] 
	)
	SELECT
	 aff.affiche_id,
	 aff.cont_num,
	 liv.Id,
	 liv.Id,
	 liv.DateLivraison,
	 aff.cont_annonc,
	 aff.commentaire,
	 aff.quantite,
	 --SUM(mvt.quantite),
	 mvt.quantite,
	 aff.theme,
	 cate.sup_nom,
	 liv.Imprimeur,
	 liv.Expediteur,
	 liv.Reference,
	 tf.sem_num,
	 tf.sem_annee
	FROM
	 #ListAfficheId lstAff
	JOIN
	 affiche aff on lstAff.afficheId = aff.affiche_id
	LEFT JOIN 
	 tf_prepa_affiche tf on  aff.affiche_id = tf.affiche_livraison_Id
	JOIN
	 tr_categorie_support cate on aff.sup_id = cate.sup_id
	JOIN
	 livraison liv on liv.Id = lstAff.Id_livraison
    LEFT JOIN
	 mouvement mvt on aff.affiche_id= mvt.affiche_id and liv.Id = mvt.livraison_id
	WHERE
	 lstAff.afficheId not in (select affiche_id from #ListAfficheSansTf_prepa)
	GROUP BY
	 aff.affiche_id,
	 aff.cont_num,
	 liv.Id,
	 liv.Id,
	 liv.DateLivraison,
	 aff.cont_annonc,
	 aff.commentaire,
	 aff.quantite,
	 aff.theme,
	 cate.sup_nom,
	 liv.Imprimeur,
	 liv.Expediteur,
	 liv.Reference,
	 mvt.quantite,
	 tf.sem_num,
	 tf.sem_annee





	select * from #ListAfficheSansTf_prepa order by LivraisonId desc 
	

	drop table #ListAfficheFiltred
	drop table #ListAfficheOrpheline
	drop table #ListAfficheId
	
END




GRANT EXECUTE
    ON OBJECT::[dbo].[p_GetPrepareListLivraison] TO [user_circe]
    AS [dbo];
;
GO
/****** Object:  StoredProcedure [dbo].[p_i_th_repart_annule]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE procedure [dbo].[p_i_th_repart_annule]
(
	@repa_ident int = null,
	@cont_num int = null,
	@typr_lib varchar(20) = null,
	@cont_annonc varchar(30) = null,
	@rpfo_qte_reserv int = null,
	@cont_anbas int = null,
	@cont_sembas int = null,
	@loginWindows varchar(50) = null,
	@IdGroupePreparation int null,
	@IdSiteCCF int null, 
	@DateModification datetime = null
)
as
begin
	-- description : insere les données de deblocage de repartition
	-- 
	-- 2013.10.08	| Wheeler A.	| creation
	-- 2017.05.03	| Wheeler A.	| ajout de l'identifiant de groupe preparation
	-- 2017.05.09	| Wheeler A.	| correction groupe preparation et ajout du site

	insert th_repart_annule(
		repa_ident,
		cont_num,
		typr_lib,
		cont_annonc,
		rpfo_qte_reserv,
		cont_anbas,
		cont_sembas,
		loginWindows,
		date_annulation,
		IdGroupePreparation,
		IdSiteCCF
	)
	select @repa_ident,
		@cont_num,
		@typr_lib,
		@cont_annonc,
		@rpfo_qte_reserv,
		@cont_anbas,
		@cont_sembas,
		@loginWindows,
		@DateModification,
		@IdGroupePreparation,
		@IdSiteCCF
		
	if @@ERROR <> 0
	begin
		return -1
	end
	
	-- fin de la procedure
	return 0
end
;
GO
/****** Object:  StoredProcedure [dbo].[p_integ_deroulants]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[p_integ_deroulants]
(
	@result int output
)
AS
begin
	--  description : proc chapeau d'integration des données des deroulants
	--
	-- 2017-04-25	| Wheeler A.	| creation
		
	declare @getdate datetime

	select @getdate = getdate()
	
	-- initialisation resultat
	-- 0 => ok
	-- 1 => erreur
	select @result = 0

	-- d'abord les trains
	exec p_integ_train_affiches @getdate, @result output

	if @result <> 0
		return 1

	-- ensuite les instructions
	exec p_integ_instructions @getdate, @result output

	if @result <> 0
		return 1

	return 0
end
;
GO
/****** Object:  StoredProcedure [dbo].[p_integ_destinataire]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[p_integ_destinataire]
AS
begin
     -- description : proc d'integration des donn�es des destinataires depuis les donn�es de PEX
     --        (adresses de livraison des afficheurs)
     --
     -- 2017.03.06 - Wheeler A.   - creation
     -- 2017.06.13 - SAMMARI M.   - Modification (Alimentation des colonnes des_mail, des_PexId, des_PexCode et suppression du IdSiteCCF,IdRessource,IdTiers et IdDepot
     -- 2018.09.04 - JERBI O.    - ajout d'une nouveau typeDestinationDA (plateforme) pour récupèrer les adresses des plateformes WISSOUS et NIMES

     declare @getdate datetime

     select @getdate = getdate()
     
     -- SJA
     update trav_adresseLivraisonAfficheur
     set LieuDit = convert ( varchar(50),LieuDit)

     /*
     TypeDestinationDA
     1 - plateforme
     2 - Site
     3 - Soci�t� sous-traitante
     4 - Afficheur
     5 - D�pot
     */
     
     -- on traite les agences en premier i.e. les sites

     -- ceux qui n'existe pas
     insert tr_destinataire 
			   (dest_nom_ori, 
				dest_nom, 
				dest_actif, 
				dest_dispatch, 
				des_id, 
				des_type, 
				dest_user, 
				dest_dat_cre, 
				dest_dat_maj, 
				des_PexId,  
				des_mail,
				des_NumTel)
     select distinct 
			   t.Destinataire, 
			   t.Destinataire, 
			   1, 
			   'O', 
			   null, 
			   td.des_type, 
			   suser_name(), 
			   @getdate, 
			   null, 
			   t.IdSiteCCF,  
			   t.des_Mail,
			   t.des_NumTel
     from 
			trav_adresseLivraisonAfficheur t
			join tr_type_destination td on (t.IdTypeDestinationDA = td.IdTypeDestinationDA)
     where 
			t.IdTypeDestinationDA = 2
		    and not exists (select 1
				           from tr_destinataire d
				           where d.des_PexId = t.IdSiteCCF and des_type = 1)

     update tr_destinataire
     set 
		 dest_nom_ori = t.Destinataire,
         dest_nom     = t.Destinataire,
         dest_actif   = 1, 
         des_type     = td.des_type,
         dest_user    = suser_name(),
         dest_dat_maj = @getdate,
         des_PexId    = t.IdSiteCCF,
         des_mail     = t.des_Mail,
         des_NumTel   = t.des_NumTel
     from 
		 tr_destinataire d
		 join trav_adresseLivraisonAfficheur t on (d.des_PexId = t.IdSiteCCF)
		 join tr_type_destination td on (t.IdTypeDestinationDA = td.IdTypeDestinationDA)
     where 
		 t.IdTypeDestinationDA = 2 
		 and d.des_type = 1 
		 --and d.dest_nom = t.Destinataire 
		 and des_PexId = t.IdSiteCCF


    insert tr_dest_adresse 
			(dest_id, 
             tad_cod, 
             adr_principale, 
             adr_num_voie, 
             adr_type_voie, 
             adr_voie, 
             adr_lieu_dit, 
             adr_localite, 
             adr_code_postal,
             adr_cedex, 
             adr_dat_maj, 
             adr_dat_cre, 
             adr_user_maj, 
             calb_id, 
             IdAdresse)
    select distinct 
			 d.dest_id,
			 '1', 
			 '1', 
			 t.NumeroDeVoie, 
			 t.TypeDeVoie, 
			 t.LibelleVoie, 
			 convert (varchar (50), isnull (t.LieuDit,'') + isnull (t.PointDeRemise,'')) , 
			 t.Commune, 
			 t.CodePostal, 
             t.Cedex, 
			 null, 
			 @getdate, 
			 suser_name(), 
			 null, 
			 t.IdAdresse
     from 
			 trav_adresseLivraisonAfficheur t
			 join tr_destinataire d on (t.IdSiteCCF = d.des_PexId)
     where 
			 t.IdTypeDestinationDA = 2
			 and not exists (select 1
                             from tr_dest_adresse a
                             where d.dest_id = a.dest_id)

     update tr_dest_adresse
     set 
		 adr_num_voie    = t.NumeroDeVoie,
         adr_type_voie   = t.TypeDeVoie,
         adr_voie        = t.LibelleVoie,
         adr_lieu_dit    = convert (varchar (50), isnull (t.LieuDit,'') + isnull (t.PointDeRemise,'')),
         adr_localite    = t.Commune,
         adr_code_postal = t.CodePostal,
         adr_cedex       = t.Cedex,
         adr_dat_maj     = @getdate, 
         adr_user_maj    = suser_name(),
         IdAdresse       = t.IdAdresse
     from 
		  tr_dest_adresse a
          join tr_destinataire d on (a.dest_id = d.dest_id)
          join trav_adresseLivraisonAfficheur t on (d.des_PexId = t.IdSiteCCF)
     where 
		  t.IdTypeDestinationDA = 2
		  and d.des_type = 1 
		  and d.dest_nom = t.Destinataire 
		  and des_PexId = t.IdSiteCCF

     -- maintenant les societes d'affichage
     insert tr_destinataire 
			   (dest_nom_ori, 
			   dest_nom, 
			   dest_actif, 
			   dest_dispatch, 
			   des_id, 
			   des_type, 
               dest_user, 
			   dest_dat_cre, 
			   dest_dat_maj,  
			   des_PexId,  
			   des_mail,
			   des_NumTel)
     select distinct 
			   t.Destinataire, 
			   t.Destinataire, 
			   1, 
			   'O', 
			   null, 
			   td.des_type, 
               suser_name(), 
			   @getdate, 
			   null, 
			   t.IdTiers,  
			   t.des_Mail,
			   t.des_NumTel
     from 
			trav_adresseLivraisonAfficheur t
		    join tr_type_destination td on (t.IdTypeDestinationDA = td.IdTypeDestinationDA)
     where 
		    t.IdTypeDestinationDA = 3
		    and not exists (select 1
                            from tr_destinataire d
                            where d.des_PexId = t.IdTiers and des_type = 2)

     update tr_destinataire
     set 
		 dest_nom_ori = t.Destinataire,
         dest_nom     = t.Destinataire,
         dest_actif   = 1, 
         des_type     = td.des_type,
         dest_user    = suser_name(),
         dest_dat_maj = @getdate,
         des_PexId    = t.IdTiers,
         des_mail     = t.des_Mail,
         des_NumTel   = t.des_NumTel
     from 
		 tr_destinataire d
		 join trav_adresseLivraisonAfficheur t on (d.des_PexId = t.IdTiers)
		 join tr_type_destination td on (t.IdTypeDestinationDA = td.IdTypeDestinationDA)
     where 
		 t.IdTypeDestinationDA = 3 
		 and d.des_type = 2 
		 --and d.dest_nom = t.Destinataire 
		 and des_PexId = t.IdTiers

     insert tr_dest_adresse 
			(dest_id, 
			 tad_cod, 
			 adr_principale, 
			 adr_num_voie, 
			 adr_type_voie, 
			 adr_voie, 
			 adr_lieu_dit, 
			 adr_localite, 
			 adr_code_postal,
             adr_cedex, 
			 adr_dat_maj, 
			 adr_dat_cre, 
			 adr_user_maj, 
			 calb_id, 
			 IdAdresse)
     select distinct 
			 d.dest_id, 
			 '1', 
			 '1', 
			 t.NumeroDeVoie, 
			 t.TypeDeVoie, 
			 t.LibelleVoie, 
			 convert (varchar (50), isnull (t.LieuDit,'') + isnull (t.PointDeRemise,'')), 
			 t.Commune, 
			 t.CodePostal, 
             t.Cedex, 
			 null, 
			 @getdate, 
			 suser_name(), 
			 null, 
			 t.IdAdresse
     from 
		  trav_adresseLivraisonAfficheur t
		  join tr_destinataire d on (t.IdTiers = d.des_PexId)
     where 
		  t.IdTypeDestinationDA = 3
		  and not exists (select 1
                          from tr_dest_adresse a
                          where d.dest_id = a.dest_id)

     update tr_dest_adresse
     set 
		 adr_num_voie    = t.NumeroDeVoie,
         adr_type_voie   = t.TypeDeVoie,
         adr_voie        = t.LibelleVoie,
         adr_lieu_dit    = convert (varchar (50), isnull (t.LieuDit,'') + isnull (t.PointDeRemise,'')),
         adr_localite    = t.Commune,
         adr_code_postal = t.CodePostal,
         adr_cedex       = t.Cedex,
         adr_dat_maj     = @getdate, 
         adr_user_maj    = suser_name(),
         IdAdresse       = t.IdAdresse
     from 
		 tr_dest_adresse a
		 join tr_destinataire d on (a.dest_id = d.dest_id)
         join trav_adresseLivraisonAfficheur t on (d.des_PexId = t.IdTiers)
     where 
	     t.IdTypeDestinationDA = 3
		 and d.des_type = 2 
		 and d.dest_nom = t.Destinataire 
		 and des_PexId = t.IdTiers

     -- les afficheurs

     insert tr_destinataire 
			   (dest_nom_ori, 
			    dest_nom, 
				dest_actif, 
				dest_dispatch, 
				des_id, 
				des_type, 
				dest_user, 
				dest_dat_cre, 
				dest_dat_maj,  
				des_PexId, 
				des_mail,
				des_NumTel)
     select distinct 
				t.Destinataire, 
				t.Destinataire, 
				1, 
				'O', 
				null, 
				td.des_type, 
                suser_name(), 
				@getdate, 
				null,  
				t.IdRessource,  
				t.des_Mail,
				t.des_NumTel
     from 
		  trav_adresseLivraisonAfficheur t
		  join tr_type_destination td on (t.IdTypeDestinationDA = td.IdTypeDestinationDA)
     where 
		  t.IdTypeDestinationDA = 4
          and not exists (select 1
                          from tr_destinataire d
                          where d.des_PexId = t.IdRessource and des_type = 0)

     update tr_destinataire
     set 
		 dest_nom_ori = t.Destinataire,
         dest_nom     = t.Destinataire,
         dest_actif   = 1, 
         des_type     = td.des_type,
         dest_user    = suser_name(),
         dest_dat_maj = @getdate,
         des_PexId    = t.IdRessource,
         des_mail     = t.des_Mail,
         des_NumTel   = t.des_NumTel
     from 
		 tr_destinataire d
		 join trav_adresseLivraisonAfficheur t on (d.des_PexId = t.IdRessource)
		 join tr_type_destination td on (t.IdTypeDestinationDA = td.IdTypeDestinationDA)
     where 
		 t.IdTypeDestinationDA = 4 
		 and d.des_type = 0 
		 --and d.dest_nom = t.Destinataire 
		 and des_PexId = t.IdRessource 

     insert tr_dest_adresse 
			  (dest_id, 
			  tad_cod, 
			  adr_principale, 
			  adr_num_voie, 
			  adr_type_voie, 
			  adr_voie, 
			  adr_lieu_dit, 
			  adr_localite, 
			  adr_code_postal,
			  adr_cedex, 
			  adr_dat_maj, 
			  adr_dat_cre, 
			  adr_user_maj, 
			  calb_id, IdAdresse)
     select distinct 
			  d.dest_id, 
			  '1', 
			  '1', 
			  t.NumeroDeVoie, 
			  t.TypeDeVoie, 
			  t.LibelleVoie, convert (varchar (50), isnull (t.LieuDit,'') + isnull (t.PointDeRemise,'')), 
			  t.Commune, 
			  t.CodePostal, 
			  t.Cedex, 
			  null, 
			  @getdate, 
			  suser_name(), 
			  null, 
			  t.IdAdresse
     from 
			trav_adresseLivraisonAfficheur t
            join tr_destinataire d on (t.IdRessource = d.des_PexId)
     where 
		    t.IdTypeDestinationDA = 4
		    and not exists (select 1
                            from tr_dest_adresse a
                            where d.dest_id = a.dest_id)

     update tr_dest_adresse
     set 
		 adr_num_voie    = t.NumeroDeVoie,
         adr_type_voie   = t.TypeDeVoie,
         adr_voie        = t.LibelleVoie,
         adr_lieu_dit    = convert (varchar (50), isnull (t.LieuDit,'') + isnull (t.PointDeRemise,'')),
         adr_localite    = t.Commune,
         adr_code_postal = t.CodePostal,
         adr_cedex       = t.Cedex,
         adr_dat_maj     = @getdate, 
         adr_user_maj    = suser_name(),
         IdAdresse       = t.IdAdresse
     from 
		 tr_dest_adresse a
		 join tr_destinataire d on (a.dest_id = d.dest_id)
         join trav_adresseLivraisonAfficheur t on (d.des_PexId = t.IdRessource)
     where 
	     t.IdTypeDestinationDA = 4
		 and d.des_type = 0 
		 and d.dest_nom = t.Destinataire 
		 and des_PexId = t.IdRessource 



     -- les depots

     insert tr_destinataire 
			  (dest_nom_ori, 
			   dest_nom, 
			   dest_actif, 
			   dest_dispatch, 
			   des_id, 
			   des_type, 
               dest_user, 
			   dest_dat_cre, 
			   dest_dat_maj, 
			   des_PexId,  
			   des_mail, 
			   des_NumTel)
     select distinct 
	           t.Destinataire, 
			   t.Destinataire, 
			   1, 
			   'O', 
			   null, 
			   td.des_type, 
               suser_name(), 
			   @getdate, 
			   null, 
			   t.IdDepot, 
			   t.des_Mail, 
			   t.des_NumTel
     from 
			trav_adresseLivraisonAfficheur t
            join tr_type_destination td on (t.IdTypeDestinationDA = td.IdTypeDestinationDA)
     where 
			t.IdTypeDestinationDA = 5
            and not exists (select 1
                            from tr_destinataire d
                            where d.des_PexId = t.IdDepot and des_type = 3)

     update tr_destinataire
     set 
		 dest_nom_ori = t.Destinataire,
         dest_nom     = t.Destinataire,
         dest_actif   = 1, 
         des_type     = td.des_type,
         dest_user    = suser_name(),
         dest_dat_maj = @getdate,
         des_PexId    = t.IdDepot,
         des_mail     = t.des_Mail,
         des_NumTel   = t.des_NumTel
     from 
		 tr_destinataire d
         join trav_adresseLivraisonAfficheur t on (d.des_PexId = t.IdDepot)
         join tr_type_destination td on (t.IdTypeDestinationDA = td.IdTypeDestinationDA)
     where 
	     t.IdTypeDestinationDA = 5 
		 and d.des_type = 3 
		 --and d.dest_nom = t.Destinataire 
		 and des_PexId = t.IdDepot 

     insert tr_dest_adresse 
			   (dest_id, 
			   tad_cod, 
			   adr_principale, 
			   adr_num_voie, 
			   adr_type_voie, 
			   adr_voie, 
			   adr_lieu_dit, 
			   adr_localite, 
			   adr_code_postal,
               adr_cedex, 
			   adr_dat_maj, 
			   adr_dat_cre, 
			   adr_user_maj, 
			   calb_id, 
			   IdAdresse)
     select distinct 
	           d.dest_id, 
			   '1', 
			   '1', 
			   t.NumeroDeVoie, 
			   t.TypeDeVoie, 
			   t.LibelleVoie, 
			   convert (varchar (50), isnull (t.LieuDit,'') + isnull (t.PointDeRemise,'')), 
			   t.Commune, 
			   t.CodePostal, 
			   t.Cedex, 
			   null, 
			   @getdate, 
			   suser_name(), 
			   null, 
			   t.IdAdresse
     from 
		   trav_adresseLivraisonAfficheur t
		   join tr_destinataire d on (t.IdDepot = d.des_PexId)
     where 
		   t.IdTypeDestinationDA = 5
		   and not exists (select 1
                           from tr_dest_adresse a
                           where d.dest_id = a.dest_id)

     update tr_dest_adresse
     set 
		 adr_num_voie    = t.NumeroDeVoie,
         adr_type_voie   = t.TypeDeVoie,
         adr_voie        = t.LibelleVoie,
         adr_lieu_dit    = convert (varchar (50), isnull (t.LieuDit,'') + isnull (t.PointDeRemise,'')),
         adr_localite    = t.Commune,
         adr_code_postal = t.CodePostal,
         adr_cedex       = t.Cedex,
         adr_dat_maj     = @getdate, 
         adr_user_maj    = suser_name(),
         IdAdresse       = t.IdAdresse
     from 
		 tr_dest_adresse a
		 join tr_destinataire d on (a.dest_id = d.dest_id)
         join trav_adresseLivraisonAfficheur t on (d.des_PexId = t.IdDepot)
     where t.IdTypeDestinationDA = 5
		   and d.des_type = 3 
		   and d.dest_nom = t.Destinataire 
		   and des_PexId = t.IdDepot 

     -- les adresses plateformes OJE 03/09/2018

     insert tr_destinataire 
			   (dest_nom_ori, 
			   dest_nom, 
			   dest_actif, 
			   dest_dispatch, 
			   des_id, 
			   des_type, 
			   dest_user, 
			   dest_dat_cre, 
			   dest_dat_maj, 
			   des_PexId,  
			   des_mail, 
			   des_NumTel)
     select distinct 
			   t.Destinataire, 
			   t.Destinataire, 
			   1, 
			   'O', 
			   null, 
			   td.des_type, 
			   suser_name(), 
			   @getdate, 
			   null, 
			   t.IdSiteCCF, 
			   t.des_Mail, 
			   t.des_NumTel
     from 
		   trav_adresseLivraisonAfficheur t
	       join tr_type_destination td on (t.IdTypeDestinationDA = td.IdTypeDestinationDA)
     where 
			t.IdTypeDestinationDA = 1
		    and not exists (select 1
                            from tr_destinataire d
                            where d.des_PexId = t.IdSiteCCF and des_type = 4)
        
     update tr_destinataire
     set 
		 dest_nom_ori = t.Destinataire,
         dest_nom     = t.Destinataire,
         dest_actif   = 1, 
         des_type     = td.des_type,
         dest_user    = suser_name(),
         dest_dat_maj = @getdate,
         des_PexId    = t.IdSiteCCF,
         des_mail     = t.des_Mail,
         des_NumTel   = t.des_NumTel
     from 
		 tr_destinataire d
		 join trav_adresseLivraisonAfficheur t on (d.des_PexId = t.IdSiteCCF)
		 join tr_type_destination td on (t.IdTypeDestinationDA = td.IdTypeDestinationDA)
     where 
		 t.IdTypeDestinationDA = 1 
		 --and d.dest_nom = t.Destinataire 
		 and des_PexId = t.IdSiteCCF 
		 and d.des_type = 4

     insert tr_dest_adresse 
		      (dest_id, 
			  tad_cod, 
			  adr_principale, 
			  adr_num_voie, 
			  adr_type_voie, 
			  adr_voie, 
			  adr_lieu_dit, 
			  adr_localite, 
			  adr_code_postal,
			  adr_cedex, 
			  adr_dat_maj, 
			  adr_dat_cre, 
			  adr_user_maj, 
			  calb_id, 
			  IdAdresse)
     select distinct 
			  d.dest_id, 
			  '1', 
			  '1', 
			  t.NumeroDeVoie, 
			  t.TypeDeVoie, 
			  t.LibelleVoie, 
			  convert (varchar (50), isnull (t.LieuDit,'') + isnull (t.PointDeRemise,'')), 
			  t.Commune, 
			  t.CodePostal, 
              t.Cedex, 
			  null, 
			  @getdate, 
			  suser_name(), 
			  null, 
			  t.IdAdresse
     from 
		trav_adresseLivraisonAfficheur t
		      join tr_destinataire d on (t.IdSiteCCF = d.des_PexId)
     where 
		t.IdTypeDestinationDA = 1
	    and not exists (select 1
                        from tr_dest_adresse a
                        where d.dest_id = a.dest_id)

     update 
		 tr_dest_adresse
     set 
		 adr_num_voie    = t.NumeroDeVoie,
         adr_type_voie   = t.TypeDeVoie,
         adr_voie        = t.LibelleVoie,
         adr_lieu_dit    = convert (varchar (50), isnull (t.LieuDit,'') + isnull (t.PointDeRemise,'')),
         adr_localite    = t.Commune,
         adr_code_postal = t.CodePostal,
         adr_cedex       = t.Cedex,
         adr_dat_maj     = @getdate, 
         adr_user_maj    = suser_name(),
         IdAdresse       = t.IdAdresse
     from 
		 tr_dest_adresse a
		 join tr_destinataire d on (a.dest_id = d.dest_id)
         join trav_adresseLivraisonAfficheur t on (d.des_PexId = t.IdSiteCCF)
     where 
	     t.IdTypeDestinationDA = 1
		 and d.dest_nom = t.Destinataire 
		 and des_PexId = t.IdSiteCCF 
		 and d.des_type = 4

     -- gestion adresse Calberson.
     update tr_dest_adresse
     set 
		  calb_id = tr_communes_calber.calb_id
     from 
		  tr_communes_calber
     where 
		   adr_localite = calb_commune
           and tr_dest_adresse.calb_id is null

	insert into tr_ate_dest_trans 
	        (dest_id,
			tsp_id, 
			tarif_code, 
			ate_id)
	select 
			tr_destinataire.dest_id, 
			2, 
			'X24',
			ate_id
    from tr_atelier, tr_destinataire
    where 
		not exists ( select 1 
					 from tr_ate_dest_trans
					 where tr_ate_dest_trans.dest_id = tr_destinataire.dest_id
						   and tr_ate_dest_trans.ate_id = tr_atelier.ate_id)
		and ate_id <> 0
		and tr_atelier.ate_id  in (1,2,5,7)

-- transporteur par d�faut � Nimes
	insert into tr_ate_dest_trans 
			 (dest_id,
			 tsp_id, 
			 tarif_code, 
			 ate_id)
    select	
			 tr_destinataire.dest_id, 
			 2, 
			 'CX',
			 ate_id
    from tr_atelier, tr_destinataire
    where 
		     not exists ( select 1 
						  from tr_ate_dest_trans
						  where tr_ate_dest_trans.dest_id = tr_destinataire.dest_id
								and tr_ate_dest_trans.ate_id = tr_atelier.ate_id)
			 and ate_id <> 0
			 and tr_atelier.ate_id  in (3,4,6,8)
   
-- Le reste
	insert into tr_ate_dest_trans 
			 (dest_id,
			 tsp_id, 
			 tarif_code, 
			 ate_id)
    select 
			 tr_destinataire.dest_id, 
			 1, 
			 'CCF',
			 ate_id
    from tr_atelier, tr_destinataire
    where 
			 not exists ( select 1 
						  from tr_ate_dest_trans
						  where tr_ate_dest_trans.dest_id = tr_destinataire.dest_id
						         and tr_ate_dest_trans.ate_id = tr_atelier.ate_id)
			 and ate_id <> 0

     return 0
end;
;
GO
/****** Object:  StoredProcedure [dbo].[p_integ_instructions]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO




CREATE procedure [dbo].[p_integ_instructions]
(
	@getdate datetime,
	@result int output
)
as
begin
	--  description : proc d'integration des instructions et exceptions des deroulants
	--
	-- 2017.04.25	| Wheeler A.	| creation
	-- 2017.05.11	| Wheeler A.	| tfs extplay 28074 - ajout de l'instruction par defaut
		
	-- initialisation resultat
	-- 0 => ok
	-- 1 => erreur
	select @result = 0

	declare @error				int,
            @log_module			varchar(50),
			@log_acteur			varchar(50),
            @entretien          int

	-- initialisation
	select @log_module = OBJECT_NAME(@@PROCID),
		@log_acteur = 'AMT'

    select @entretien           = 8
    
	-- Debut
	update tra_amt_log_instruction set talr_trait = '1'

    -- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @getdate, @log_module, 'tra_amt_log_instruction 1', @log_acteur
		select @result = 1
        return 1
	end

	update tra_amt_log_instruc_det set talr_trait = '1'
    
    -- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @getdate, @log_module, 'tra_amt_log_instruc_det 1', @log_acteur
		select @result = 1
        return 1
	end
    
	select type_instruction,
		rese_ident,  
		cont_num,
		nom,
		cont_anbas,
		cont_sembas,
		convert    (varchar(18),  null) instr_code,
		convert    (smallint,  null) ate_id,
		convert    (smallint,  null) tpr_id,
		convert    (tinyint,  null) tsr_repart_code,
		convert    (tinyint,  null) rpc_statut,
		sect_code_centre,
		form_larg,
		form_haut,
		tyaf_code,
		typr_code,
		date_ligne,
		talr_trait,
		theme,
		pourcentage,
		afch_ident,
		convert    (char,  null)  'statut',
		convert    (char,  null)  'statut_visuels',
		convert (smallint,  null)  'sup_id',
		tra_amt_log_instruction.Commentaire as Commentaire
    into #instruction_train
	from tra_amt_log_instruction
    where sect_code_centre is not null
    and talr_trait = '1'

	-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @getdate, @log_module, '#instruction_train', @log_acteur
		select @result = 1
        return 1
	end

	-- Gestion de l'entete des intructions
	-- update #instruction_train set sup_id = typr_code

	-- on met à jour le sup_id
	update #instruction_train
	set sup_id = tcs.sup_id
	from #instruction_train t
	join TypePreparation tp on (t.typr_code = tp.IdTypePreparation)
	join transcoCategSupport tcs on (tp.tpr_id = tcs.tpr_id
										and t.tyaf_code = tcs.IdSurface
										and tcs.estBandeau = 0)

	-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @getdate, @log_module, 'sup_id', @log_acteur
		select @result = 1
        return 1
	end

	-- atelier

	update #instruction_train
	set ate_id = case	when tyaf_code = 5 and sect_code_centre = 39 then 5 -- 2m2 scro wissous
						when tyaf_code = 5 and sect_code_centre = 40 then 6 -- 2m2 scro nimes
						when tyaf_code = 7 and sect_code_centre = 39 then 7 -- 8m2 scro wissous
						when tyaf_code = 7 and sect_code_centre = 40 then 8 -- 8m2 scro nimes
						when tyaf_code = 6 and sect_code_centre = 39 then 11 -- 4m2 scro wissous
						when tyaf_code = 6 and sect_code_centre = 40 then 12 -- 4m2 scro nimes
						else 0
					end
	from #instruction_train

	/*
	--type de preparation
	--12	RX8
	update #instruction_train
	set tpr_id = 12
	where tyaf_code = 615 
	*/
	
	--11	venusial => tout sur du scro
	update #instruction_train
	set tpr_id = 10, sup_id = 26
	--where tyaf_code in (650, 660)
	--where sup_id != 29

	--update #instruction_train
	--set tpr_id = 10
	--where sup_id = 29

	update #instruction_train
	set tpr_id = 2
	where type_instruction = 'contrat bdx'
	
	update #instruction_train 
	set instr_code = convert (varchar (4),cont_anbas) + right ('0' + convert (varchar (4),cont_sembas),2) + 
		'C0'+ right ('0' +convert ( VARCHAR(2) ,ate_id),2) + right ('00000000' +convert ( varchar ,cont_num),8)
	--where type_instruction = 'contrat'

	-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @getdate, @log_module, 'instr_code1', @log_acteur
		select @result = 1
        return 1
	end
	
	/********************************
	 * lignes d'instuctions - chapeau
	*************************** */
    
	-- ancien code instruction existe => en maj
	update #instruction_train 
	set rpc_statut = instruction_train.rpc_statut,  
		statut = 'M'
	from instruction_train 
	where #instruction_train.instr_code = instruction_train.instr_code

	-- suppression si les instructions ont ?t? valid?es, sont en cours de pr?paration
	delete from 
	#instruction_train
	where rpc_statut in (2,5)

	-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @getdate, @log_module, 'delete 2,5', @log_acteur
		select @result = 1
        return 1
	end

	-- erreur corrigee
	update #instruction_train
	set rpc_statut = 1
	where rpc_statut = 3

	-- sinon premiere instruction statut en cours tsr_repart_code.
	update #instruction_train 
	set rpc_statut = 1,
		statut = 'N', 
		tsr_repart_code = 0, 
		statut_visuels = 'N'
	where statut is null

	-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @getdate, @log_module, 'New instructions visuels', @log_acteur
		select @result = 1
        return 1
	end

	-- insertion des lignes.
	insert into  instruction_train (
		instr_code,
		ate_id,
		tsr_repart_code,
		rpc_statut,
		instr_type_instruction,
		rese_ident,
		cont_num,
		instr_annonceur,
		cont_anbas,
		cont_sembas,
		instr_commentaire,
		instr_dat_cre,
		instr_dat_maj,
		instr_user,
		instr_entretien,
		tip_ins_code,
		instr_CommentExtPlay)
	select distinct instr_code,
	   ate_id,
	   tsr_repart_code,
	   rpc_statut,
	   type_instruction,
	   rese_ident,
	   cont_num,
	   nom,
	   cont_anbas,
	   cont_sembas,
	   null,
	   @getdate,
	   null,
	   @log_acteur,
	   @entretien,
	   0,
	   Commentaire
	from #instruction_train
	where statut = 'N'
	and type_instruction in ( 'contrat', 'reseau')
	and not exists (	select 1 
						from instruction_train 
						where #instruction_train.instr_code = instruction_train.instr_code)

	-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @getdate, @log_module, 'instruction_train alors ?', @log_acteur
        return 1
	end

	--------------------------------
	-- Cas mise à jour d'instruction
	--------------------------------
	update instruction_train
	set  instruction_train.instr_dat_maj  = @getdate,
		 instruction_train.instr_user     = @log_acteur ,
		 instruction_train.rpc_statut     =  1,
		 instruction_train.instr_annonceur = #instruction_train.nom,
		 instruction_train.instr_CommentExtPlay = #instruction_train.Commentaire
	from instruction_train, 
		#instruction_train
	where instruction_train.instr_code =  #instruction_train.instr_code       
	and statut = 'M'
	and instruction_train.rpc_statut not in (5,2,4)

	-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @getdate, @log_module, 'update instruction_train 1', @log_acteur
        return 1
	end

	------------------------------
	-- maj instuctions les visuels
	------------------------------

	update #instruction_train
	set statut_visuels = 'M'
	from instruction_visuels, #instruction_train
	where statut_visuels is null
	and statut = 'M'
	and instruction_visuels.instr_code = #instruction_train.instr_code
	and instruction_visuels.insv_afch_ident = #instruction_train.afch_ident

	-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @getdate, @log_module, 'modif instructions visuels', @log_acteur
		select @result = 1
        return 1
	end

	-- sinon premi?re instruction statut en cours tsr_repart_code.
	update #instruction_train 
	set statut_visuels = 'N'
	where statut_visuels is null

	-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @getdate, @log_module, 'New visuels', @log_acteur
		select @result = 1
        return 1
	end

	-- insertion des lignes.
	insert into instruction_visuels (
		instr_code,
		sup_id,
		tpr_id,
		rpc_statut,
		insv_afch_ident,
		insv_theme_ori,
		insv_pourcentage_ori,
		insv_theme,
		insv_pourcentage,
		insv_dat_cre,
		insv_user)
	select distinct 
	  instr_code,
	  sup_id,
	  tpr_id,
	  rpc_statut,
	  afch_ident,
	  theme,
	  pourcentage,
	  theme,
	  pourcentage,
	  @getdate,
	  @log_acteur
	from #instruction_train
	where statut_visuels = 'N'
	and exists (	select 1 
					from instruction_train
					where #instruction_train.instr_code = instruction_train.instr_code )

	-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @getdate, @log_module, 'instruction_visuels', @log_acteur
		select @result = 1
        return 1
	end

	-- Pour le moment, on annule et remplace.
	delete from #instruction_train where  statut_visuels = 'D'

	-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @getdate, @log_module, 'delete instruction_visuels', @log_acteur
		select @result = 1
        return 1
	end
 
	update instruction_visuels
	set insv_theme_ori = theme,
		insv_pourcentage_ori = pourcentage,
		insv_theme = theme,
		insv_pourcentage = pourcentage
	from #instruction_train, instruction_visuels
	where instruction_visuels.instr_code = #instruction_train.instr_code
	and instruction_visuels.insv_afch_ident = #instruction_train.afch_ident
	and statut_visuels = 'M'

	-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @getdate, @log_module, ' maj instruction_visuels', @log_acteur
		select @result = 1
        return 1
	end

	---------------------------------
	-- traitement des lignes de train
	---------------------------------

	-- mise a jour des reservations : statut passe a 1.
	update tf_face_train
	set tf_face_train.rpc_statut =  1, 
		ft_dat_maj = @getdate, 
		ft_user_maj = @log_acteur
	from tf_face_train, #instruction_train
	where tf_face_train.rpc_statut  in ( 0, 3)
	and tf_face_train.instr_code = #instruction_train.instr_code

	-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @getdate, @log_module, 'tf_face_train', @log_acteur
		select @result = 1
        return 1
	end
      
	-- select * from #instruction_train

	------------------------------------------------------
	----Les instructions ? la face : annule et remplace.
	------------------------------------------------------
	select distinct
		origine,	
		cont_num,	
		cadr_ident,	
		cdep_datdep,	
		date_ligne,
		sect_code,	
		valeur,
		rese_ident,	
		depa_code,
		aggl_numord	,
		afch_ident,	
		theme,
		sect_code_centre,
		form_larg,
		form_haut,
		tyaf_code,
		talr_trait,
		convert(varchar (20),  null)  'type_instruction' ,
		isnull(cont_anbas,0) cont_anbas,
		isnull(cont_sembas,0) cont_sembas,
		convert(varchar(18),  null) instr_code,
		convert(smallint,  null) ate_id,
		convert(smallint,  null) tpr_id,
		convert(tinyint,  null) tsr_repart_code,
		convert(tinyint,  null) rpc_statut,
		convert(char,  null)  'statut',
		convert(char,  null)  'statut_visuels',
		convert(smallint,  null)  'sup_id',
		cadre_lib,
		IdTypePreparation
	into #instruction_detail
	from tra_amt_log_instruc_det
	where sect_code_centre is not null
	and talr_trait = '1'
    
	-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @getdate, @log_module, '#instruction_detail', @log_acteur
		select @result = 1
        return 1
	end
	
	-- atelier
	-- 8m2 scro wissous
	/*
	update #instruction_detail
	set ate_id = 7
	where sect_code_centre = 32
	and form_larg = 306
 
	-- 8m2 scro N?mes
	update #instruction_detail
	set ate_id = 8
	where sect_code_centre = 34
	and form_larg = 306

	-- 2m2 scro wissous
	update #instruction_detail
	set ate_id = 5
	where sect_code_centre = 32
	and ate_id is null

	-- 2m2 scro wissous
	update #instruction_detail
	set ate_id = 6
	where sect_code_centre = 34
	and ate_id is null
	*/
	update #instruction_detail
	set ate_id = case	when tyaf_code = 5 and sect_code_centre = 39 then 5 -- 2m2 scro wissous
						when tyaf_code = 5 and sect_code_centre = 40 then 6 -- 2m2 scro nimes
						when tyaf_code = 7 and sect_code_centre = 39 then 7 -- 8m2 scro wissous
						when tyaf_code = 7 and sect_code_centre = 40 then 8 -- 8m2 scro nimes
						when tyaf_code = 6 and sect_code_centre = 39 then 11 -- 4m2 scro wissous
						when tyaf_code = 6 and sect_code_centre = 40 then 12 -- 4m2 scro nimes
						else 0
					end
	from #instruction_detail

	/*
	--Type de pr?paration
	--12	RX8
	update #instruction_detail
	set tpr_id = 12
	where tyaf_code = 615 
	*/

	/*
	--11	Venusial
	update #instruction_detail
	set tpr_id = 11, 
		sup_id = 1026
	where tyaf_code in (650, 660)

	--10	Scro
	update #instruction_detail
	set tpr_id = 10 
	where tpr_id is null

	-- les bandeaux
	update #instruction_detail
	set tpr_id = 2
	where tyaf_code = 2
	*/

	update #instruction_detail
	set tpr_id = 11, 
		sup_id = 1026
	where IdTypePreparation = 21	-- venusial

	update #instruction_detail
	set tpr_id = 10 
	where tpr_id is null

	update #instruction_detail
	set tpr_id = 2
	where origine = 'bdx'

	--on ne concerve que support
	update #instruction_train set sup_id = null

	update #instruction_detail 
	set instr_code = convert (varchar (4),cont_anbas) + right ('0' + convert (varchar (4),cont_sembas),2) + 
				'C0'+ right ('0' +convert ( VARCHAR(2) ,ate_id),2) + right ('00000000' +convert ( varchar ,cont_num),8)
	where cont_num is not null

	/*
	update #instruction_detail 
	set instr_code = convert (varchar (4),cont_anbas) + right ('00',2) + 
		'C'+ right ('0' +convert ( varchar ,ate_id),2) + right ('000000000' +convert ( varchar ,cont_num),9)
	where cont_num is not null
	*/
	
	/*
	update #instruction_detail 
	set instr_code = convert (varchar (4),cont_anbas) + right ('0' + convert (varchar (4),cont_sembas),2) + 
		'R'+ right ('0' +convert ( varchar ,ate_id),2) + right ('000000000' +convert ( varchar ,rese_ident),9)
	where  cont_num is null
	*/

	delete from instruction_detail 
	where instr_code in (	select instr_code 
							from #instruction_detail )

	-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @getdate, @log_module, 'delete instruction_detail', @log_acteur
		select @result = 1
        return 1
	end

	insert into instruction_detail (
		instr_code,
		insd_cadr_ident,
		insd_cadre_lib,
		sup_id,
		tpr_id,
		insd_afch_ident,
		insd_theme,
		insd_repiquage_ident,
		insd_repiquage,
		insd_type,
		insd_dat_cre,
		ins_dat_maj,
		insd_user)
	select distinct instr_code, cadr_ident, isnull(cadre_lib, origine), 
		sup_id, tpr_id, afch_ident, theme, null, null, origine, @getdate, null, @log_acteur
	from #instruction_detail
	where  tpr_id <> 2
	and exists (select 1 
				from instruction_train
				where #instruction_detail.instr_code = instruction_train.instr_code )

	-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @getdate, @log_module, 'insert instruction_detail', @log_acteur
		select @result = 1
        return 1
	end

	-- les bdx
	insert into instruction_detail (
		instr_code,
		insd_cadr_ident,
		insd_cadre_lib,
		sup_id,
		tpr_id,
		insd_afch_ident,
		insd_theme,
		insd_repiquage_ident,
		insd_repiquage,
		insd_type,
		insd_dat_cre,
		ins_dat_maj,
		insd_user)
	select distinct instr_code, cadr_ident, isnull(cadre_lib, origine), sup_id, tpr_id, 
		null, null, afch_ident, theme, origine, @getdate, null, @log_acteur
	from #instruction_detail
	where tpr_id = 2
	and exists (select 1 
				from instruction_train
				where #instruction_detail.instr_code = instruction_train.instr_code )

	--select * from #instruction_detail
	update tra_amt_log_instruction set talr_trait = 'T' where talr_trait = '1'

	-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @getdate, @log_module, 'tra_amt_log_instruction fin', @log_acteur
		select @result = 1
        return 1
	end
    
	-- maj entretien par defaut.
	update instruction_train set instr_entretien = 8 where instr_entretien is null
    
	-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @getdate, @log_module, 'instruction_train entretien', @log_acteur
		select @result = 1
        return 1
	end
    
    update tra_amt_log_instruc_det set talr_trait = 'T' where talr_trait = '1'

	-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @getdate, @log_module, 'tra_amt_log_instruc_det fin', @log_acteur
		select @result = 1
        return 1
	end

	-- archivage des données
	insert th_amt_log_instruction (Id, type_instruction, rese_ident, cont_num, nom, 
		date_ligne, afch_ident, theme, sect_code_centre, pourcentage, form_larg, form_haut, 
		tyaf_code, typr_code, cont_anbas, cont_sembas, talr_trait, dat_trait)
	select Id, type_instruction, rese_ident, cont_num, nom, 
		date_ligne, afch_ident, theme, sect_code_centre, pourcentage, form_larg, form_haut, 
		tyaf_code, typr_code, cont_anbas, cont_sembas, talr_trait, @getdate
	from tra_amt_log_instruction

	insert th_amt_log_instruc_det (Id, origine, cont_num, cadr_ident, cdep_datdep, date_ligne, 
		sect_code, valeur, rese_ident, depa_code, aggl_numord, afch_ident, theme, sect_code_centre, 
		form_larg, form_haut, tyaf_code, talr_trait, dat_trait, type_instruction, cont_anbas, cont_sembas, 
		cadre_lib, IdFaceOTAffichage, IdTypePreparation)
	select Id, origine, cont_num, cadr_ident, cdep_datdep, date_ligne, 
		sect_code, valeur, rese_ident, depa_code, aggl_numord, afch_ident, theme, sect_code_centre, 
		form_larg, form_haut, tyaf_code, talr_trait, @getdate, type_instruction, cont_anbas, cont_sembas, 
		cadre_lib, IdFaceOTAffichage, IdTypePreparation
	from tra_amt_log_instruc_det

	return 0
end
;

GO
/****** Object:  StoredProcedure [dbo].[p_integ_preparation]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


CREATE PROCEDURE [dbo].[p_integ_preparation]
(
	@result int output
)
AS
begin
	--  description : proc d'integration des donn?es de preparation
	--				2m2 fixe et pliage
	--
	-- 2017-03-01	| Wheeler A.	| creation
	-- 2017-04-18	| Wheeler A.	| tfs 27095 - correction sur le sup_id pour les bandeaux	
	-- 2017-11-06   | Jribi Omar    | tfs 3244 - Fix proc p_integ_preparation + livraison rec (2.0.0.0)
	declare @getdate datetime,
	@getdateJoursMinuit datetime,
	@dateDebutSemaine datetime,
	@indice int


	select @getdate = getdate()
	select @getdateJoursMinuit = convert(varchar, getdate(), 112)
	select @indice = datepart(weekday, @getdate)-2
	select @dateDebutSemaine = dateadd(dd, -@indice, @getdateJoursMinuit)
	
	-- initialisation resultat
	-- 0 => ok
	-- 1 => erreur
	select @result = 0

	-- controle si les lignes existent deja en statut non annul?s
	if exists (	select 1
				from trav_preparation t
				join tf_repart_calcul rc on (t.IdPreparationDetail = rc.IdPreparationDetail
					and t.IdDossierDeVenteChapeau = rc.cont_num)
				where rc.rpc_statut <> 4 and t.IdReferentielStatutPreparation = 133)
				
	
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @getdate, object_name(@@procid), 'tentative d''insertion des donn?es en doublon : IdPreparationDetail = '+convert(varchar,t.IdPreparationDetail), suser_name()
		from trav_preparation t
		join tf_repart_calcul rc on (t.IdPreparationDetail = rc.IdPreparationDetail)
		where rc.rpc_statut <> 4 and t.IdReferentielStatutPreparation = 133

		-- on met les lignes ? annuler qu'ont essaye d'integrer ? nouveau
		update trav_preparation
		set rpc_statut = 4	-- annuler
		from trav_preparation t
		join tf_repart_calcul rc on (t.IdPreparationDetail = rc.IdPreparationDetail)
		where rc.rpc_statut <> 4 and t.IdReferentielStatutPreparation = 133

		--select @result = 1
	end

	-- creation table travail
	--select * into #temp from tf_repart_calcul where 1=2

	create table #temp 
	([rpc_id] [numeric](9, 0) NULL,
	[sup_id] [smallint] NULL,
	[ate_id] [smallint] NULL,
	[soc_id] [tinyint] NULL,
	[sem_num] [tinyint] NULL,
	[sem_annee] [smallint] NULL,
	[des_id] [numeric](9, 0) NULL,
	[des_type] [tinyint] NULL,
	[des_type_adr] [tinyint] NULL,
	[tpr_id] [smallint] NULL,
	[act_id] [smallint] NULL,
	[rpc_type] [tinyint] NULL,
	[rpc_repartition] [numeric](9, 0) NULL,
	[rpc_annonceur] [varchar](50) NULL,
	[rpc_theme] [varchar](50) NULL,
	[rpc_num_aff_amt] [numeric](9, 0) NULL,
	[rpc_qte] [int] NULL,
	[rpc_dat_aff] [datetime] NULL,
	[rpc_statut] [tinyint] NULL,
	[rpc_refacturation] [tinyint] NULL,
	[rpc_rpfo_ident] [numeric](9, 0) NULL,
	[rpc_user] [varchar](30) NULL,
	[rpc_dat_cre] [smalldatetime] NULL,
	[rpc_dat_maj] [smalldatetime] NULL,
	[rpc_tms] [timestamp] NULL,
	[rpc_san_rep] [char](1) NULL,
	[cont_num] [int] NULL,
	[numeroReception] [varchar](20) NULL,
	[pers_ident] [numeric](9, 0) NULL,
	[pers_nom] [varchar](50) NULL,
	[UM_id] [int] NULL,
	[dest_id] [int] NULL,
	[rpc_retire] [char](1) NULL,
	[IdPreparationDetail] [int] NULL,
	[rpc_repiquageId] [int] NULL,
	[rpc_repiquage] [varchar](50) NULL,
	IdTypeDestinationDA int null,
	IdDestinataire int null
	)

	-- on cr?er les lignes des themes de bases pour tout ce qui est diff?rent du scro
	insert into #temp (sup_id, ate_id, sem_num, sem_annee, tpr_id, rpc_repartition,
		rpc_annonceur, rpc_theme,rpc_repiquage, rpc_num_aff_amt,rpc_repiquageId, rpc_qte, rpc_dat_aff, rpc_statut, rpc_rpfo_ident, 
		rpc_user, rpc_dat_cre, cont_num, pers_ident, pers_nom, IdPreparationDetail,IdTypeDestinationDA,IdDestinataire)
	select null, -- a faire sup_id
		case	when t.IdTypePreparation = 23 and t.IdSiteCCF = 39 then	2 -- pliage wissous
				when t.IdTypePreparation = 23 and t.IdSiteCCF = 40 then 3 -- pliage nimes
				-- SJA
                when t.IdTypePreparation = 23 and t.IdSiteCCF = 43 then 9 -- pliage DBG
				-- done
                when t.IdTypePreparation = 23 and t.IdSiteCCF = 44 then 10 -- pliage DBG 2
				when t.IdTypePreparation <> 23 and t.IdSiteCCF = 39 then 1 -- 2m? fixe wissous
				when t.IdTypePreparation <> 23 and t.IdSiteCCF = 40 then 4 -- 2m? fixe nimes
				else 0 
		end,
		t.Semaine, 
		t.AnneeSemaine, 
		tp.tpr_id, 
		t.IdPreparationChapeau,
		t.Annonceur,
		t.Theme,
		case	
				when t.IdTypePreparation <> 23 and t.IdSiteCCF = 39 then t.ThemeBandeau -- 2m? fixe wissous
				when t.IdTypePreparation <> 23 and t.IdSiteCCF = 40 then  t.ThemeBandeau -- 2m? fixe nimes
				else null
		end,
		t.IdTheme,
		case	
				when t.IdTypePreparation <> 23 and t.IdSiteCCF = 39 then  t.IdThemeBandeau -- 2m? fixe wissous
				when t.IdTypePreparation <> 23 and t.IdSiteCCF = 40 then  t.IdThemeBandeau -- 2m? fixe nimes
				else null
		end,
		t.QuantiteEntretien,
		t.DatePremierDepart, 
		0, 
		t.IdGroupePreparation,
		suser_name(),
		GETDATE(),
		t.IdDossierDeVenteChapeau, 
		t.IdRessource,
		ltrim(isnull(t.Nom, '')+' '+isnull(t.Prenom, '')), 
		IdPreparationDetail,
		IdTypeDestinationDA,IdDestinataire
	from trav_preparation t
	left join TypePreparation tp on (t.IdTypePreparation = tp.IdTypePreparation)
	where t.rpc_statut <> 4
	and t.IdTypePreparation not in (17, 18, 19, 20, 21,28)		-- on exclu les d?roulants et RX8
	and t.IdReferentielStatutPreparation = 133
	--select * from #temp
	--return


	-- gestion des bandeaux
	-- pour le moment on dublique les lignes pour le 2m? et le pliage
	insert into #temp (sup_id, ate_id, sem_num, sem_annee, tpr_id, rpc_repartition,
		rpc_annonceur, rpc_theme, rpc_num_aff_amt, rpc_qte, rpc_dat_aff, rpc_statut, rpc_rpfo_ident, 
		rpc_user, rpc_dat_cre, cont_num, pers_ident, pers_nom, IdPreparationDetail,IdTypeDestinationDA,IdDestinataire)
	select null, -- a faire sup_id
		case	when t.IdTypePreparation = 23 and t.IdSiteCCF = 39 then	2 -- pliage wissous
				when t.IdTypePreparation = 23 and t.IdSiteCCF = 40 then 3 -- pliage nimes
                when t.IdTypePreparation = 23 and t.IdSiteCCF = 43 then 9 -- pliage DBG
				-- done
                when t.IdTypePreparation = 23 and t.IdSiteCCF = 44 then 10 -- pliage DBG Lyon
                
							else 0 
		end,
		t.Semaine, 
		t.AnneeSemaine, 
		2, -- type preparation bandeau
		t.IdPreparationChapeau,
		t.Annonceur,
		t.ThemeBandeau,
		t.IdThemeBandeau,
		t.QuantiteEntretien,
		t.DatePremierDepart, 
		0, 
		t.IdGroupePreparation,
		suser_name(),
		@getdate,
		t.IdDossierDeVenteChapeau, 
		t.IdRessource,
		ltrim(isnull(t.Nom, '')+' '+isnull(t.Prenom, '')),
		IdPreparationDetail,
		IdTypeDestinationDA,IdDestinataire
	from trav_preparation t
	left join TypePreparation tp on (t.IdTypePreparation = tp.IdTypePreparation)
	where t.rpc_statut <> 4
	--and t.IdTypePreparation not in (17, 18, 19, 20, 21)		-- on exclu les d?roulants et RX8
	-- SJA
	--done
    and ( t.IdTypePreparation = 23 and t.IdSiteCCF in (39,40,43,44)) -- on garde le pliage pour wissous et nimes
	and t.IdThemeBandeau is not null
	and t.IdReferentielStatutPreparation = 133

	-- on transcode le sup_id, pour la preparation classique
	update #temp
	set sup_id = c.sup_id
	from #temp t
	join trav_preparation p on (t.IdPreparationDetail = p.IdPreparationDetail)
	join TypePreparation tp on (p.IdTypePreparation = tp.IdTypePreparation)
	join transcoCategSupport c on (tp.tpr_id = c.tpr_id
									and p.IdSurface = c.IdSurface)
	where t.tpr_id <> 2
	and c.estBandeau = 0
	and p.IdReferentielStatutPreparation = 133

	-- pour les bandeaux
	update #temp
	set sup_id = c.sup_id
	from #temp t
	join trav_preparation p on (t.IdPreparationDetail = p.IdPreparationDetail)
	join transcoCategSupport c on (t.tpr_id = c.tpr_id
									and p.IdSurface = c.IdSurface)
	where t.tpr_id = 2
	and c.estBandeau = 1
	and p.IdReferentielStatutPreparation = 133

	-- mise ? jour du dest_id en fonction du type de destinataire
	-- a reworker en une seule passe si une seule colonne
	
	-- transco du type
	update #temp
	set des_type = t.des_type
	from tr_type_destination t
	where #temp.IdTypeDestinationDA = t.IdTypeDestinationDA



	update #temp
	set dest_id = d.dest_id
	from #temp t
	join tr_destinataire d on (t.IdDestinataire = d.des_PexId
					and t.des_type = d.des_type)

	--select * from #temp
		
	-- insert dans table finale tf_repart_calcul
	-- et alimentation du soc_id
    -- SJA 20180129 : pas d'int?gration de la S062018 depuis BC
    insert tf_repart_calcul (sup_id, ate_id, sem_num, sem_annee, tpr_id, rpc_repartition,
		rpc_annonceur, rpc_theme,rpc_repiquage,rpc_repiquageId, rpc_num_aff_amt, rpc_qte, rpc_dat_aff, rpc_statut, rpc_rpfo_ident, 
		rpc_user, rpc_dat_cre, cont_num, pers_ident, pers_nom, IdPreparationDetail, dest_id, soc_id)
	select t.sup_id, t.ate_id, t.sem_num, t.sem_annee, t.tpr_id, t.rpc_repartition,
		t.rpc_annonceur, t.rpc_theme,t.rpc_repiquage,t.rpc_repiquageId, t.rpc_num_aff_amt, t.rpc_qte, t.rpc_dat_aff, t.rpc_statut, t.rpc_rpfo_ident, 
		t.rpc_user, t.rpc_dat_cre, t.cont_num, t.pers_ident, t.pers_nom, t.IdPreparationDetail, t.dest_id, 1
	from #temp t
	left join tf_repart_calcul tr on tr.IdPreparationDetail = t.IdPreparationDetail
	where  tr.IdPreparationDetail  is null
--where sem_num <> 6 
--and sem_annee =2018

	-- on met ? jour les statuts de la table de travail ? termin? 
	-- pour indiquer les groupes de travail correctement int?grer
	update trav_preparation
	set rpc_statut = 8
	from trav_preparation t
	join tf_repart_calcul r on (t.IdPreparationDetail = r.IdPreparationDetail
			and t.IdDossierDeVenteChapeau = r.cont_num)
	and t.IdReferentielStatutPreparation = 133

	update trav_preparation
	set rpc_statut = 8
	from trav_preparation t
	where t.IdTypePreparation  in (17, 18, 19, 20, 21)		-- on exclu les d?roulants et RX8
	and t.IdReferentielStatutPreparation = 133

	-- controle que tout le groupe de preparation est correctement int?grer
	-- sinon on insere un log
	insert tt_log (log_date, log_module, log_desc, log_acteur)
	select @getdate, 
		object_name(@@procid), 
		'integration groupe de preparation partiel : IdGroupePreparation = '+convert(varchar,t.IdGroupePreparation), 
		suser_name()
	from trav_preparation t
	where t.IdReferentielStatutPreparation = 133
	group by t.IdGroupePreparation
	having count(distinct rpc_statut) <> 8

	--if @@rowcount > 0
	--begin
		-- select @result = 1
	--end

	-- archivage
	insert histo_preparation (IdPreparationChapeau, IdGroupePreparation, IdPreparationDetail, IdDossierDeVenteChapeau, DatePremierDepart, 
		Annonceur, IdTheme, Theme, IdThemeBandeau, ThemeBandeau, IdTypePreparation, IdFormat, IdSurface, IdSiteCCF, Semaine, AnneeSemaine, 
		Quantite, QuantiteEntretien, IdRessource, Nom, Prenom, IdTypeDestinationDA, IdDestinataire, IdAdresse, rpc_statut, quiCreation, dateCreation)
	select IdPreparationChapeau, IdGroupePreparation, IdPreparationDetail, IdDossierDeVenteChapeau, DatePremierDepart, 
		Annonceur, IdTheme, Theme, IdThemeBandeau, ThemeBandeau, IdTypePreparation, IdFormat, IdSurface, IdSiteCCF, Semaine, AnneeSemaine, 
		Quantite, QuantiteEntretien, IdRessource, Nom, Prenom, IdTypeDestinationDA, IdDestinataire, IdAdresse, rpc_statut, suser_name(), @getdate
	from trav_preparation
	where IdReferentielStatutPreparation = 133



	---- Update ressource
	CREATE TABLE #tempUpdate ( IdPreparationDetail int, Quantite int)

	if (datepart(weekday, @getdate) = 2 or	-- lundi
		datepart(weekday, @getdate) = 3 or  -- mardi
        datepart(weekday, @getdate) = 4 or 	-- mercredi
        datepart(weekday, @getdate) = 5 )	-- SJA jeudi
        
	begin
		-- on supprime tout ce qui est inferieur ? la semaine prochaine
			
			insert into #tempUpdate ( IdPreparationDetail , Quantite )
			select t.IdPreparationDetail, t.QuantiteEntretien
			from trav_preparation t
			join tf_repart_calcul tr on tr.IdPreparationDetail = t.IdPreparationDetail
			where t.DatePremierDepart >= dateadd(day, 14, @dateDebutSemaine)	and tr.rpc_statut in (0,1)

	end
	else
	begin
		-- on n'est plus lundi ou mardi
		-- on ne tiens plus compte des donn?es de la semaine prochaine
			insert into #tempUpdate ( IdPreparationDetail , Quantite )
			select t.IdPreparationDetail, t.QuantiteEntretien
			from trav_preparation t
			join tf_repart_calcul tr on tr.IdPreparationDetail = t.IdPreparationDetail
			where t.DatePremierDepart >= dateadd(day, 21, @dateDebutSemaine) and tr.rpc_statut in (0,1) and tr.UM_id is null
		
	end

		update tf_repart_calcul
	set 
	rpc_qte = Quantite
	, rpc_dat_maj = @getdate
	from  #tempUpdate tem
	join tf_repart_calcul trc on  tem.IdPreparationDetail = trc.IdPreparationDetail


	-- on retourne la liste des groupes int?gr?s
	select distinct IdGroupePreparation
	from trav_preparation
	where rpc_statut <> 4 and IdReferentielStatutPreparation = 133

	return 0
end

;
;
;;

GO
/****** Object:  StoredProcedure [dbo].[p_integ_ptf_cadre_trains]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[p_integ_ptf_cadre_trains]
AS
BEGIN
-------------------------------------------------------------------------------
--  Procedure            : p_integ_ptf_trains
--  Auteur               : SJAOEN
--  Date de creation     : 18/10/2014
--  Description 	 : integration des cadre de train
--  Auteur - Date - Nature modif. :
--  Parametres d'entree  :      -
--  Parametres de sortie :      -
--  Retour 		 : 	(=0 : OK) ; (!=0 - erreur fonctionnelle ou serveur)
-------------------------------------------------------------------------------
-- ?			| Sammari Maher | ajout colonne conservation et cotecote
-- 2017.06.28	| Wheeler A.	| correction pour compilation


	declare 
      @error				int,
      @log_module			varchar(50),
	  @log_acteur			varchar(50),
      @entretien            int

    -- initialisation
	select @log_module = OBJECT_NAME(@@PROCID),
	@log_acteur = 'AMT'
    


-- des lignes deja en base a taiter ?
------------------ Gestion des 
	-- creation des instructions
	-- copie des donnees

update tra_amt_log_train set talr_trait = '1'


select @entretien             = 8
    -- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'tra_amt_log_train 1', @log_acteur
        return 1
	end

select 
   convert    (varchar(18),  null) instr_code,
   cadr_ident           ,
   rdep_datdep          ,
   empl_ident           ,
   pers_ident           ,
   pers_nom             ,
   tyaf_code            ,
   reac_code            ,
   typr_code            ,
   isnull( cont_sembas  ,0) cont_sembas,
   isnull( cont_anbas  ,0) cont_anbas,
   cont_num             ,
   cont_annonc          ,
   tald_type            ,
   tald_soci_code       ,
   tald_code            ,
   empl_sect_code       ,
   empl_depa_code       ,
   comm_numord          ,
   empl_numord          ,
   empl_addresse1       ,
   empl_addresse2       ,
   empl_addresse3       ,
   cadr_lettre          ,
   form_larg            ,
   form_haut            ,
   agreement            ,
   sect_code_prepa      ,
   train                ,
   rang                 ,
   rese_ident           ,
   idre_nom             ,
   panel_ident          ,
   talr_trait           ,
   convert    (char,  null)  'statut',
   convert    (smallint,  null)  'rpc_statut',
   convert (smallint,  null)  'sup_id',
   convert (int ,  null)  'ate_id',
   convert (int ,  null)  'tpr_id',
   convert (varchar (20),  null)  'cadre_lib' ,
   convert (int, null) 'dest_id',
   convert (smallint,  null)  'dep_sembas' ,
   convert (smallint, null) 'dep_anbas',
   convert (varchar(50), null) 'commune'

   into #train
	from tra_amt_log_train
    where sect_code_prepa is not null
    and talr_trait = '1'


-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, '#train', @log_acteur
        return 1
	end

update #train set sup_id = typr_code

-- suppression des faces RX8 -- IT 37887
delete from #train where sup_id = 28

-- pour la gestion des anomalies
select @error = @@error
if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'typr_code', @log_acteur
        return 1
end


-------- code instructions.
-- atelier
-- 8m2 scro wissous
update #train
set ate_id = 7
where sect_code_prepa = 32
and form_larg = 306
 
-- 8m2 scro Nimes
update #train
set ate_id = 8
where sect_code_prepa = 34
and form_larg = 306

-- 2m2 scro wissous
update #train
set ate_id = 5
where sect_code_prepa = 32
and ate_id is null

-- 2m2 scro wissous
update #train
set ate_id = 6
where sect_code_prepa = 34
and ate_id is null

--type de preparation
--12	RX8
update #train
set tpr_id = 12
where tyaf_code = 615 

--11	venusial
update #train
set tpr_id = 11, sup_id = 1026
where tyaf_code in (650, 660)

--10	Scro
update #train
set tpr_id = 10 
where tpr_id is null

update 
#train
set 
    dep_anbas  = datepart( Year, rdep_datdep) ,
    dep_sembas  =	datepart( ISO_WEEK, rdep_datdep) 
where 
   dep_sembas is null

-- Attention a la semaine 01/2015... un 30/12/2014   
--update 
--#train
--set 
 --  dep_anbas = dep_anbas + 1
  --  where 
   --dep_sembas = 1
   --and datepart( mm, rdep_datdep) > 1

-- Attention ? la semaine 01/2015... un 30/12/2014   
update 
#train
set 
   cont_anbas = cont_anbas + 1,
   cont_sembas = 1
     where 
   cont_sembas = 53
   and cont_anbas in (2015) 
-- pour la gestion des anomalies
select @error = @@error
if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'semaine', @log_acteur
        return 1
end


/*
update #train 
set instr_code = convert (varchar (4),cont_anbas) + right ('0' + convert (varchar (2),cont_sembas),2) + 'C'+ right ('0' +convert ( varchar ,ate_id),2) + right ('000000000' +convert ( varchar ,cont_num),9)
where cont_num is not null
*/

update #train 
set instr_code = convert (varchar (4),cont_anbas) + right ('00'+convert (varchar (2),cont_sembas),2) + 'C'+ right ('0' +convert ( varchar ,ate_id),2) + right ('000000000' +convert ( varchar ,cont_num),9)
where cont_num is not null


-- pour la gestion des anomalies
select @error = @@error
if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'instr_code 1', @log_acteur
        return 1
end


update #train 
set instr_code = convert (varchar (4),dep_anbas) + right ('0' + convert (varchar (4),dep_sembas),2) + 'R'+ right ('0' +convert ( varchar ,ate_id),2) + right ('000000000' +convert ( varchar ,rese_ident),9)
where cont_num is null


-- pour la gestion des anomalies
select @error = @@error
if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'instr_code 2', @log_acteur
        return 1
end


--------------- menages, lignes a ne pas integrer

-- pas d'integration des reservation passees.
delete from #train where rdep_datdep < getdate()

-- pour la gestion des anomalies
select @error = @@error
if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'instr_code 2', @log_acteur
        return 1
end

-- pas d'integration des preparations pretes. 
-- SJA - 20160418
delete #train from 
#train , instruction_train
where #train.instr_code = instruction_train.instr_code
and instruction_train.rpc_statut not in (0,1)


-- pour la gestion des anomalies
select @error = @@error
if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'delete 2', @log_acteur
        return 1
end
--------------- 
 
update #train set
commune = tr_commune.comm_nom
from tr_commune, #train 
where #train.empl_depa_code =  tr_commune.depa_code
and #train.comm_numord = tr_commune.comm_numord


-- ancien code rang dans train existe deja => en maj
update #train 
set statut = 'M'
from tf_face_train where 
#train.instr_code = tf_face_train.instr_code
-- and #train.cadr_ident = tf_face_train.cadr_ident
 
 
-- pour la gestion des anomalies
select @error = @@error
if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'M', @log_acteur
        return 1
end
 
-- ancien code rang dans train existe deja => en maj
update #train 
set  #train.rpc_statut = instruction_train.rpc_statut
from instruction_train where 
#train.instr_code = instruction_train.instr_code


-- pour la gestion des anomalies
select @error = @@error
if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'rpc_statut', @log_acteur
        return 1
end

-- erreur corrigee
update #train
set rpc_statut = 1
where rpc_statut = 3

-- sinon premiere instruction statut en cours tsr_repart_code.
update #train 
set rpc_statut = 0 , statut = 'N'
where rpc_statut is null

update #train 
set statut = 'N'
where statut is null

--select statut , instr_code,cont_num,'SJA-fin', * from #train

select 'dest'
update #train 
set #train.dest_id = tr_destinataire.dest_id 
from #train ,tr_destinataire
where tald_code            = des_id
and tr_destinataire.des_type = 0
and  #train.tald_type = 'LB'


update #train 
set #train.dest_id = tr_destinataire.dest_id 
from #train ,tr_destinataire
where tald_code            = des_id
and tr_destinataire.des_type = 0
and  #train.tald_type = 'LB'


update #train 
set #train.dest_id = tr_destinataire.dest_id 
from #train ,tr_destinataire
where tald_code            = des_id
and tr_destinataire.des_type = 2
and  #train.tald_type = 'SA'

--le reste
update #train 
set #train.dest_id = tr_destinataire.dest_id 
from #train ,tr_destinataire
where tald_code      = des_id
and tr_destinataire.des_type = 1
and  #train.dest_id is null

-- pour la gestion des anomalies
select @error = @@error
if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'destinataire', @log_acteur
        return 1
end


update #train set cadre_lib = convert (varchar ,empl_sect_code)
+'-'+ right ('00' + empl_depa_code,2)+ '-'+ right ('000'+convert (varchar,comm_numord) ,3)+'-'+  right ('000'+convert (varchar,empl_numord) ,4) + ' ' +cadr_lettre

-- pour la gestion des anomalies
select @error = @@error
if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'cadre_lib ', @log_acteur
        return 1
end

-- suppression des anciennes réservation. à faire par contrat/semaine/statut.
delete from tf_face_train
from tf_face_train, #train
where  
-- tf_face_train.instr_code in (select distinct instr_code from #train)
 exists (select 1 from #train t2
    where tf_face_train.cont_sembas = t2.cont_sembas
    and tf_face_train.cont_anbas = t2.cont_anbas
    and tf_face_train.cont_num = t2.cont_num
  )
  and tf_face_train.rdep_datdep > getdate()
  and tf_face_train.rpc_statut in (0,1,3,4)


-- pour la gestion des anomalies
select @error = @@error
if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'delete tf_face_train ', @log_acteur
        return 1
end

-- insertion des lignes.
insert into  tf_face_train (
   dest_id              ,
   rpc_statut           ,
   ate_id               ,
   sup_id               ,
   instr_code           ,
   cadr_ident           ,
   cadre_lib            ,
   rdep_datdep          ,
   empl_ident           ,
   pers_ident           ,
   pers_nom             ,
   tyaf_code            ,
   reac_code            ,
   typr_code            ,
   cont_sembas          ,
   cont_anbas           ,
   cont_num             ,
   cont_annonc          ,
   empl_sect_code       ,
   empl_depa_code       ,
   comm_numord          ,
   empl_numord          ,
   empl_addresse1       ,
   empl_addresse2       ,
   empl_addresse3       ,
   cadr_lettre          ,
   form_larg            ,
   form_haut            ,
   agreement            ,
   train                ,
   rang                 ,
   rese_ident           ,
   idre_nom             ,
   panel_ident          ,
   ft_dat_cre           ,
   ft_user_maj  ,
   dep_sembas,
   dep_anbas,
   ft_type,
   commune
      )
   
select distinct 
    dest_id,
   rpc_statut           ,
   ate_id               ,
   sup_id               ,
   instr_code           ,
   cadr_ident           ,
   cadre_lib            ,
   rdep_datdep          ,
   empl_ident           ,
   pers_ident           ,
   pers_nom             ,
   tyaf_code            ,
   reac_code            ,
   typr_code            ,
   cont_sembas          ,
   cont_anbas    ,
   cont_num      ,
   cont_annonc   ,
   empl_sect_code,
   empl_depa_code,
   comm_numord   ,
   empl_numord   ,
   empl_addresse1,
   empl_addresse2,
   empl_addresse3,
   cadr_lettre   ,
   form_larg     ,
   form_haut     ,
   agreement     ,
   train         ,
   rang          ,
   rese_ident    ,
   idre_nom      ,
   panel_ident   ,
   getdate()     ,
   'AMT'         ,
   dep_sembas    ,
   dep_anbas     ,
   'Face',
   commune
from #train
where statut in ('N', 'M')
and instr_code is not null

-- pour la gestion des anomalies
select @error = @@error

if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'insert tf_face_train', @log_acteur
        select @error
        return 1
end

/*
select distinct instr_code, ate_id,0 ,0,'contrat' ,cont_num, cont_annonc,cont_anbas, isnull(cont_sembas,0), getdate (), 'AMT'
from tf_face_train
where cont_num is not null
and  not exists (select 1 from instruction_train
where tf_face_train.instr_code = instruction_train.instr_code)
and cont_anbas is not null
*/

-- Ajout des chapeaux d'instuction manquants.(contrats)
insert into instruction_train (instr_code, ate_id, tsr_repart_code	, rpc_statut, instr_type_instruction,	cont_num,  instr_annonceur, cont_anbas, cont_sembas, instr_dat_cre	, instr_user,Conservation,CoteCote)
select distinct instr_code, ate_id,0 ,0,'contrat' ,cont_num, cont_annonc,cont_anbas, isnull(cont_sembas,0), getdate (), 'AMT',Conservation,CoteCote
from tf_face_train
where cont_num is not null
and  not exists (select 1 from instruction_train
where tf_face_train.instr_code = instruction_train.instr_code)
and cont_anbas is not null



-- pour la gestion des anomalies
select @error = @@error
if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'instruction_train 1 ', @log_acteur
        return 1
end

/*
select distinct instr_code, ate_id,0 ,0,'reseau' ,rese_ident, cont_annonc,cont_anbas, cont_sembas, getdate (), 'AMT', @entretien,0
from tf_face_train
where cont_num is null
and  not exists (select 1 from instruction_train
where tf_face_train.instr_code = instruction_train.instr_code)
and cont_annonc is not null
*/
-- Ajout des chapeaux d'instuction manquants.(reseaux)
insert into instruction_train (instr_code, ate_id, tsr_repart_code	, rpc_statut, instr_type_instruction,	rese_ident,  instr_annonceur, cont_anbas, cont_sembas, instr_dat_cre	, instr_user, instr_entretien, tip_ins_code,Conservation,CoteCote)
select distinct instr_code, ate_id,0 ,0,'reseau' ,rese_ident, cont_annonc,cont_anbas, cont_sembas, getdate (), 'AMT', @entretien,0,Conservation,CoteCote
from tf_face_train
where cont_num is null
and  not exists (select 1 from instruction_train
where tf_face_train.instr_code = instruction_train.instr_code)
and cont_annonc is not null


-- pour la gestion des anomalies
select @error = @@error
if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'instruction_train 2', @log_acteur
        return 1
end


update tra_amt_log_train set talr_trait = 'T' where talr_trait = '1'

-- pour la gestion des anomalies
select @error = @@error
if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'tra_amt_log_train fin', @log_acteur
        return 1
end

return 0



END
;

GO
/****** Object:  StoredProcedure [dbo].[p_integ_ptf_des]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[p_integ_ptf_des]
AS
BEGIN
-------------------------------------------------------------------------------
--  Procédure            : p_integ_ptf_des
--  Auteur               : SJA
--  Date de création     : 13/11/2014
--  Description 	 : phase 2 du traitement des répartitions -
--				intégration des lignes de repartition et destinations à traiter
--				contenues dans les tables log PTF
--				dans les tables fonctionnelles ptf (calcul repart, destinations)
--				et génération des anomalies sur les répartitions
--  Auteur - Date - Nature modif. :
--  	AMS - 05/07/07 - ...
--		ELE - 18/06/09 - bt 3781 : suppression doublons dans tf_repart_calcul et
--									log des tentatives d'insertion de doublons
--									Traitement d'erreur sur insert dans cette table
--  Paramètres d'entrée  :      -
--  Paramètres de sortie :      -
--  Retour 		 : 	(=0 : OK) ; (!=0 - erreur fonctionnelle ou serveur)
-------------------------------------------------------------------------------
-- 2013.09.17	| Wheeler A.	| integration du personnel dans le calcul de repartition
-- 2014.11.07	| Wheeler A.	| evo 39 lot 8 maj pour la maj du scenario lot SSIS
-- SJA IT 36016 : set up transporteurs par défaut

	declare @error				int,
	 		@sup_id 			smallint,
			@des_id 			numeric(9),
			@des_type 			smallint,
			@tpr_id				smallint,
			@act_id 			smallint,
			@ate_id 			smallint,
			@rpc_id 			numeric(9),
			@des_type_adr		tinyint,
			@tw_id 				numeric(9),
			@statut 			tinyint,
			@log_module			varchar(50),
			@log_acteur			varchar(50),
			@des_nom			varchar(50),
			@des_adr1			varchar(50),
			@des_postal			char(5),
			@des_localite		varchar(50),
			@des_id_current		numeric(9),
			@des_type_current	tinyint,
			@des_adr_current	tinyint,
			@des_mail			varchar(30),
            @dest_id            int

	-- initialisation
	select @log_module = OBJECT_NAME(@@PROCID),
		@log_acteur = SUSER_NAME()


	--  traitement destinations à mettre à jour
	update tr_destination
	set des_nom = dest_nom,
		des_adr_1 = case when dest_numvoie is null then dest_voie
													else cast(dest_numvoie as char(4)) + dest_voie
					end,
		des_adr_2 = dest_voiesuite,
		des_postal = convert(char(5), dest_codpost),
		des_localite = isnull(dest_commune, dest_burdistrib),
		des_tel	= dest_tel,
		des_fax = dest_fax,
		des_mail = dest_email
	from tr_destination d
	join tw_amt_log_destination w on (d.des_id = w.tald_code)
	where (	(des_type = 1 and tald_type = '1T')
		or	(des_type = 0 and tald_type = 'LB')
		or	(des_type = 2 and tald_type = 'SA')
		)
	and d.des_type_adr = 0

	select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'erreur maj destinataire 1', @log_acteur
        return 1
	end

	update tw_amt_log_destination
	set dest_trait = '1'
	from tw_amt_log_destination t
	join tr_destination d on (t.tald_code = d.des_id)
	where (	(des_type = 1 and tald_type = '1T')
		or	(des_type = 0 and tald_type = 'LB')
		or	(des_type = 2 and tald_type = 'SA')
		)
	and d.des_type_adr = 0

	select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'erreur maj destinataire2', @log_acteur
        return 1
	end

	-- traitement nouvelles destinations à intégrer
	insert tr_destination(
		des_id,
		des_type,
		des_type_adr,
		tsp_id,
		des_nom,
		des_actif,
		des_adr_1,
		des_adr_2,
		des_adr_3,
		des_postal,
		des_localite,
		des_tel,
		des_fax,
		des_mail,
		des_user,
		des_dat_cre,
		des_dat_maj)
	select tald_code,
		case tald_type	when 'LB' then 0
						when 'SA' then 2
								  else 1
						end,
		0,
		0,
		dest_nom,
		1,
		cast(dest_numvoie as char(4)) + dest_voie,
		dest_voiesuite,
		null,
		dest_codpost,
		isnull(dest_commune, dest_burdistrib),
		dest_tel,
		dest_fax,
		dest_email,
		'user_ptf',
		getdate(),
		getdate()
	from tw_amt_log_destination
	where dest_trait <> '1'
	or dest_trait is null

	select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'erreur maj destinataire 3', @log_acteur
        return 1
	end

	-- SJA ajout des nouveaux destinataires
	insert tr_destinataire (dest_nom_ori, dest_nom, dest_actif, dest_user, 
		dest_dat_cre, dest_dat_maj, dest_dispatch, des_id, des_type)
	select des_nom, des_nom, 1, 'batch', getdate(), getdate(), 'N', des_id, des_type
	from tr_destination d1
	where not exists (select 1
						from tr_destinataire d2
						where d1.des_id = d2.des_id 
                        -- SJA !
                        and d1.des_type = d2.des_type
                        )


	select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'erreur maj destinataire 4', @log_acteur
        return 1
	end


    -- SJA udpate des destinataires
	update tr_destinataire 
    set tr_destinataire.dest_nom_ori = tr_destination.des_nom,
    tr_destinataire.dest_nom = tr_destination.des_nom,
    dest_dat_maj = getdate()
    from tr_destination 
    where tr_destinataire.des_id = tr_destination.des_id
    and tr_destinataire.des_type = tr_destination.des_type
    and tr_destination.des_actif = 1
    and tr_destinataire.dest_nom_ori <> tr_destination.des_nom
    
	select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'erreur maj destinataire 5', @log_acteur
        return 1
	end

    -- maj des adresses
    update tr_dest_adresse
    set tr_dest_adresse.adr_voie =  des.des_adr_1,
        tr_dest_adresse.adr_lieu_dit =  des.des_adr_2,
        tr_dest_adresse.adr_localite =  des.des_localite,
        tr_dest_adresse.adr_code_postal =  des.des_postal,
        tr_dest_adresse.adr_cedex = '',
        tr_dest_adresse.adr_dat_maj = GETDATE(),
        tr_dest_adresse.adr_user_maj = 'batch'
    from tr_destination des ,tr_destinataire d
    where 
     des.des_id = d.des_id 
    AND  des.des_type = d.des_type
    and  des.des_actif = 1
    and tr_dest_adresse.dest_id = d.dest_id
    and tr_dest_adresse.adr_principale = '1'

select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'erreur maj des adresses fin', @log_acteur
        return 1
	end


insert into tr_dest_adresse 
    (dest_id,
    tad_cod, 
    adr_principale,
    adr_voie,
    adr_lieu_dit,
    adr_localite,
    adr_code_postal,
    adr_cedex,
    adr_dat_cre,
    adr_user_maj)

select d.dest_id, '1', '1',des.des_adr_1,des_adr_2,des.des_localite,des.des_postal,'',getdate(),'batch'
from tr_destination des ,tr_destinataire d
where 
 des.des_id = d.des_id 
AND  des.des_type = d.des_type
and  des.des_actif = 1
and 
not exists ( select 1 from tr_dest_adresse
where  tr_dest_adresse.dest_id = d.dest_id
and tr_dest_adresse.adr_principale = '1'
)

select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'erreur insert tr_dest_adresse', @log_acteur
        return 1
	end

-- gestion adresse Calberson.
update tr_dest_adresse
set calb_id = tr_communes_calber.calb_id
from tr_communes_calber
where adr_localite = calb_commune
and tr_dest_adresse.calb_id is null
select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'erreur adresse calber 1', @log_acteur
        return 1
	end



update tr_dest_adresse
set calb_id = tr_communes_calber.calb_id
from tr_communes_calber
where upper (adr_localite) = calb_commune
and tr_dest_adresse.calb_id is null
select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'erreur adresse calber 2', @log_acteur
        return 1
	end

update tr_dest_adresse
set calb_id = tr_communes_calber.calb_id
from tr_communes_calber
where replace ( adr_localite, ' CEDEX',  '') = calb_commune
and tr_dest_adresse.calb_id is null

select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'erreur adresse calber 3', @log_acteur
        return 1
	end

   
-- SJA IT 36016
-- Lien atelier !

-- transporteur par défaut à wissous
insert into tr_ate_dest_trans (dest_id,tsp_id, tarif_code, ate_id)
    select tr_destinataire.dest_id, 2, 'X24',ate_id
    from tr_atelier, tr_destinataire
    where 
    not exists ( select 1 
        from tr_ate_dest_trans
        where tr_ate_dest_trans.dest_id = tr_destinataire.dest_id
              and tr_ate_dest_trans.ate_id = tr_atelier.ate_id)
    and ate_id <> 0
    and tr_atelier.ate_id  in (1,2,5,7)

select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'insert Lien atelier Wissous', @log_acteur
        return 1
	end


-- transporteur par défaut à Nimes
insert into tr_ate_dest_trans (dest_id,tsp_id, tarif_code, ate_id)
    select tr_destinataire.dest_id, 2, 'CX',ate_id
    from tr_atelier, tr_destinataire
    where 
    not exists ( select 1 
        from tr_ate_dest_trans
        where tr_ate_dest_trans.dest_id = tr_destinataire.dest_id
        and tr_ate_dest_trans.ate_id = tr_atelier.ate_id)
    and ate_id <> 0
    and tr_atelier.ate_id  in (3,4,6,8)
   
   select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'insert Lien atelier nimes', @log_acteur
        return 1
	end
   


-- Le reste
insert into tr_ate_dest_trans (dest_id,tsp_id, tarif_code, ate_id)
    select tr_destinataire.dest_id, 1, 'CCF',ate_id
    from tr_atelier, tr_destinataire
    where 
    not exists ( select 1 
        from tr_ate_dest_trans
        where tr_ate_dest_trans.dest_id = tr_destinataire.dest_id
              and tr_ate_dest_trans.ate_id = tr_atelier.ate_id)
    and ate_id <> 0

    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'insert Lien atelier le reste', @log_acteur
        return 1
	end
   
	-- fin de la procedure
	return 0
end
GO
/****** Object:  StoredProcedure [dbo].[p_integ_ptf_histo_purge]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE proc [dbo].[p_integ_ptf_histo_purge]
as
begin
	-- description : procedure pour archiver et supprimer les données de travail
	--		de l'alimentation de Circe
	--
	-- Wheeler A.	| 2014.11.06	| creation
	
	-- comme il peut y avoir des insertions de données entre la lecture des données par le lot SSIS
	-- l'integration de ses données dans ptf et la suppression de celle-ci sur bdamt
	-- on identifie les données à integrer dans ptf avec la colonne talr_trait à 'B' pour blocage
	
	-- archivage des données
	insert th_amt_log_repart (
    repa_ident, 
    rpfo_ident, 
    pers_ident, 
    tyaf_code, 
    pers_nom, 
    tald_type, 
	tald_soci_code, 
    tald_code, 
    reac_code, 
    typr_code, 
    rpli_datdep, 
    rpli_anbas, 
    rpli_sembas, 
	soci_code, 
    sect_code, 
    afch_ident, 
    afch_lib, 
    cont_num, 
    cont_annonc, 
    rpty_qte_affich, 
    talr_trait, 
    dat_trait) 
	select 
    repa_ident, 
    rpfo_ident, 
    pers_ident, 
    tyaf_code, 
    pers_nom, 
    tald_type, 
	tald_soci_code, 
    tald_code, 
    reac_code, 
    typr_code, 
    rpli_datdep, 
    rpli_anbas, 
    rpli_sembas, 
	soci_code, 
    sect_code, 
    afch_ident, 
    afch_lib, 
    cont_num, 
    cont_annonc, 
    rpty_qte_affich, 
    talr_trait, 
    getdate()
	from tw_amt_log_repart where talr_trait = 'T'
	
	insert th_amt_log_destination (
    tald_type, 
    tald_soci_code, 
    tald_code, 
    dat_trait, 
    dest_nom, 
    dest_numvoie, 
    dest_voie, 
	dest_voiesuite, 
    dest_codpost, 
    dest_commune, 
    dest_burdistrib, 
    dest_tel, 
    dest_fax, 
    dest_email)
	
    select 
    tald_type, 
    tald_soci_code, 
    tald_code, 
    getdate(), 
    dest_nom, 
    dest_numvoie, 
    dest_voie, 
	dest_voiesuite, 
    dest_codpost, 
    dest_commune, 
    dest_burdistrib, 
    dest_tel, dest_fax, dest_email
	from tw_amt_log_destination
	where dest_trait <> 1
	or dest_trait is null
	
	insert th_amt_log_instruction (
    type_instruction     ,
    rese_ident           ,
    cont_num             ,
    nom                  ,
    date_ligne           ,
    afch_ident           ,
    theme                ,
    sect_code_centre     ,
    pourcentage          ,
    form_larg            ,
    form_haut            ,
    tyaf_code            ,
    typr_code            ,
    cont_anbas           ,
    cont_sembas          ,
    talr_trait           ,
    dat_trait            )
select 
    type_instruction     ,
    rese_ident           ,
    cont_num             ,
    nom                  ,
    date_ligne           ,
    afch_ident           ,
    theme                ,
    sect_code_centre     ,
    pourcentage          ,
    form_larg            ,
    form_haut            ,
    tyaf_code            ,
    typr_code            ,
    cont_anbas           ,
    cont_sembas          ,
    talr_trait           ,
    getdate()
from tra_amt_log_instruction where talr_trait = 'T'    
    
insert th_amt_log_instruc_det (
    origine, 
    cont_num, 
    cadr_ident, 
    cdep_datdep, 
    date_ligne, 
    sect_code, 
    valeur,   
    rese_ident, 
    depa_code, 
    aggl_numord,	
    afch_ident, 
    theme, 
    sect_code_centre, 
    form_larg, 
    form_haut, 
    tyaf_code, 
    talr_trait, 
    dat_trait, 
    type_instruction,	
    cont_anbas, 
    cont_sembas,
    cadre_lib)
select 
    origine, 
    cont_num, 
    cadr_ident, 
    cdep_datdep, 
    date_ligne, 
    sect_code, 
    valeur,   
    rese_ident, 
    depa_code, 
    aggl_numord,	
    afch_ident, 
    theme, 
    sect_code_centre, 
    form_larg, 
    form_haut, 
    tyaf_code, 
    talr_trait, 
    getdate(), 
    type_instruction,	
    cont_anbas, 
    cont_sembas,
    cadre_lib 
from tra_amt_log_instruc_det where talr_trait = 'T'

insert th_amt_log_statut_repart (   
    repa_ident           ,
    statut               ,
    date_statut          ,
    talr_trait           ,
    cont_num             ,
    rpfo_ident           ,
    cont_datbas          ,
    cont_sembas          ,
    typr_code            ,
    dat_trait            )

select 
    repa_ident           ,
    statut               ,
    date_statut          ,
    talr_trait           ,
    cont_num             ,
    rpfo_ident           ,
    cont_datbas          ,
    cont_sembas          ,
    typr_code            ,
    getdate() 
from tra_amt_log_statut_repart where talr_trait = 'T'

	
insert th_amt_log_train (
    cadr_ident           ,
    rdep_datdep          ,
    empl_ident           ,
    pers_ident           ,
    pers_nom             ,
    tyaf_code            ,
    reac_code            ,
    typr_code            ,
    cont_sembas          ,
    cont_anbas           ,
    cont_num             ,
    cont_annonc          ,
    tald_type            ,
    tald_soci_code       ,
    tald_code            ,
    empl_sect_code       ,
    empl_depa_code       ,
    comm_numord          ,
    empl_numord          ,
    empl_addresse1       ,
    empl_addresse2       ,
    empl_addresse3       ,
    cadr_lettre          ,
    form_larg            ,
    form_haut            ,
    agreement            ,
    sect_code_prepa      ,
    train                ,
    rang                 ,
    rese_ident           ,
    idre_nom             ,
    panel_ident          ,
    talr_trait           ,
    dat_trait            )
    select 
    cadr_ident           ,
    rdep_datdep          ,
    empl_ident           ,
    pers_ident           ,
    pers_nom             ,
    tyaf_code            ,
    reac_code            ,
    typr_code            ,
    cont_sembas          ,
    cont_anbas           ,
    cont_num             ,
    cont_annonc          ,
    tald_type            ,
    tald_soci_code       ,
    tald_code            ,
    empl_sect_code       ,
    empl_depa_code       ,
    comm_numord          ,
    empl_numord          ,
    empl_addresse1       ,
    empl_addresse2       ,
    empl_addresse3       ,
    cadr_lettre          ,
    form_larg            ,
    form_haut            ,
    agreement            ,
    sect_code_prepa      ,
    train                ,
    rang                 ,
    rese_ident           ,
    idre_nom             ,
    panel_ident          ,
    talr_trait           ,
    getdate() 
    from tra_amt_log_train where talr_trait = 'T'
	
	-- suppression des données
	exec p_integ_ptf_purge

	-- fin de la procedure
	return 0
end

GO
/****** Object:  StoredProcedure [dbo].[p_integ_ptf_init]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
create proc [dbo].[p_integ_ptf_init]
as
begin
	-- description : procedure pour supprimer les données de travail
	--		de l'alimentation de Circe
	--
	-- Wheeler A.	| 2014.11.06	| creation
	
	-- comme il peut y avoir des insertions de données entre la lecture des données par le lot SSIS
	-- l'integration de ses données dans ptf et la suppression de celle-ci sur bdamt
	-- on identifie les données à integrer dans ptf avec la colonne talr_trait à 'B' pour blocage
	-- ses données une fois traiter sont flager à 'T'



	-- suppression des données
	delete from tw_amt_log_repart
	
	delete from tw_amt_log_destination
	
	delete from tra_amt_log_instruction
	
	delete from tra_amt_log_instruc_det
	
	delete from tra_amt_log_statut_repart 
	
	delete from tra_amt_log_train 

	-- fin de la procedure
	return 0
end
GO
/****** Object:  StoredProcedure [dbo].[p_integ_ptf_instructions]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


CREATE PROCEDURE [dbo].[p_integ_ptf_instructions]
AS
BEGIN
-------------------------------------------------------------------------------
--  Proc?dure            : p_integ_ptf_instructions
--  Auteur               : SJAOEN
--  Date de cr?ation     : 18/10/2014
--  Description 	 : int?gration des trains.
--  Auteur - Date - Nature modif. :
--  Param?tres d'entr?e  :      -
--  Param?tres de sortie :      -
--  Retour 		 : 	(=0 : OK) ; (!=0 - erreur fonctionnelle ou serveur)
-------------------------------------------------------------------------------

	declare 
            @error				int,
            @log_module			varchar(50),
			@log_acteur			varchar(50),
            @entretien          int

	-- initialisation
	select @log_module = OBJECT_NAME(@@PROCID),
		@log_acteur = 'AMT'

    select @entretien           = 8
    
-- D?but
update tra_amt_log_instruction set talr_trait = '1'

    -- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'tra_amt_log_instruction 1', @log_acteur
        return 1
	end

update tra_amt_log_instruc_det set talr_trait = '1'
    
    -- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'tra_amt_log_instruc_det 1', @log_acteur
        return 1
	end
    
   
	select 
    type_instruction,
    rese_ident,  
    cont_num,
    nom,
    cont_anbas,
    cont_sembas,
    convert    (varchar(18),  null) instr_code,
    convert    (smallint,  null) ate_id,
    convert    (smallint,  null) tpr_id,
    convert    (tinyint,  null) tsr_repart_code,
    convert    (tinyint,  null) rpc_statut,
	sect_code_centre,
    form_larg,
    form_haut,
    tyaf_code,
    typr_code,
    date_ligne,
    talr_trait,
    theme,
    pourcentage,
    afch_ident,
    convert    (char,  null)  'statut',
    convert    (char,  null)  'statut_visuels',
    convert (smallint,  null)  'sup_id'
    into #instruction_train
	from tra_amt_log_instruction
    where sect_code_centre is not null
    and talr_trait = '1'

 -- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, '#instruction_train', @log_acteur
        return 1
	end


/*************************
 * Gestion de l'ent?te des intructions
 **************** */
update #instruction_train set sup_id = typr_code

-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'sup_id', @log_acteur
        return 1
	end

-- atelier
-- 8m2 scro wissous
update #instruction_train
set ate_id = 7
where sect_code_centre = 32
and form_larg = 306
 
-- 8m2 scro N?mes
update #instruction_train
set ate_id = 8
where sect_code_centre = 34
and form_larg = 306

-- 2m2 scro wissous
update #instruction_train
set ate_id = 5
where sect_code_centre = 32
and ate_id is null

-- 2m2 scro N?mes
update #instruction_train
set ate_id = 6
where sect_code_centre = 34
and ate_id is null

--type de pr?paration
--12	RX8
update #instruction_train
set tpr_id = 12
where tyaf_code = 615 

--11	v?nusial => tout sur du scro
update #instruction_train
set tpr_id = 10, sup_id = 26
where tyaf_code in (650, 660)


update #instruction_train
set tpr_id = 2
where type_instruction = 'contrat bdx'

--10	Scro le reste - pas discriminant pour les visuels
update #instruction_train
set tpr_id = 10 
where tpr_id is null

-- cas contrat sans annee/semaine
update 
#instruction_train set cont_anbas = 0, cont_sembas= 0
where cont_sembas is null 
and cont_num is not null

update 
#instruction_train
set 
    cont_anbas =    datepart( Year, date_ligne) ,
    cont_sembas =	datepart( ISO_WEEK, date_ligne) 
where 
   cont_sembas is null

-- Attention ? la semaine 01/2015... un 30/12/2014   
update 
#instruction_train
set 
   cont_anbas = cont_anbas + 1,
   cont_sembas = 1
     where 
   cont_sembas = 53
   and cont_anbas in (2015) 


--return 0
-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'annee', @log_acteur
        return 1
	end



update #instruction_train 
set instr_code = convert (varchar (4),cont_anbas) + right ('0' + convert (varchar (4),cont_sembas),2) + 'C'+ right ('0' +convert ( varchar ,ate_id),2) + right ('000000000' +convert ( varchar ,cont_num),9)
where type_instruction = 'contrat'


-- gestion pour bandeaux
update #instruction_train 
set instr_code = convert (varchar (4),cont_anbas) + right ('0' + convert (varchar (4),cont_sembas),2) + 'C'+ right ('0' +convert ( varchar ,ate_id),2) + right ('000000000' +convert ( varchar ,cont_num),9)
where type_instruction = 'contrat bdx'



/*
update #instruction_train 
set instr_code = convert (varchar (4),cont_anbas) + right ('00',2) + 'C'+ right ('0' +convert ( varchar ,ate_id),2) + right ('000000000' +convert ( varchar ,cont_num),9)
where type_instruction = 'contrat'
*/

-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'instr_code1', @log_acteur
        return 1
	end

update #instruction_train 
set instr_code = convert (varchar (4),cont_anbas) + right ('0' + convert (varchar (4),cont_sembas),2) + 'R'+ right ('0' +convert ( varchar ,ate_id),2) + right ('000000000' +convert ( varchar ,rese_ident),9)
where type_instruction = 'reseau'

-- SJA => Pas d'int�gration AMT sup � S06 2018
--delete 
--from #instruction_train
--where 
--instr_code  > '201806'


-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'instr_code2', @log_acteur
        return 1
	end
    


/********************************
 * lignes d'instuctions - chapeau
*************************** */
    
-- ancien code instruction existe => en maj
update #instruction_train 
set rpc_statut = instruction_train.rpc_statut,  statut = 'M'
from instruction_train where 
#instruction_train.instr_code = instruction_train.instr_code

-- suppression si les instructions ont ?t? valid?es, sont en cours de pr?paration
delete from 
#instruction_train
where rpc_statut in (2,5)

-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'delete 2,5', @log_acteur
        return 1
	end

-- erreur corrig?e
update #instruction_train
set rpc_statut = 1
where rpc_statut = 3

-- sinon premi?re instruction statut en cours tsr_repart_code.
update #instruction_train 
set rpc_statut = 1 , statut = 'N', tsr_repart_code = 0, statut_visuels = 'N'
where statut is null

-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'New instructions visuels', @log_acteur
        return 1
	end

-- insertion des lignes.
insert into  instruction_train (
   instr_code       ,
   ate_id           ,
   tsr_repart_code  ,
   rpc_statut       ,
   instr_type_instruction ,
   rese_ident       ,
   cont_num         ,
   instr_annonceur        ,
   cont_anbas       ,
   cont_sembas      ,
   instr_commentaire,
   instr_dat_cre    ,
   instr_dat_maj    ,
   instr_user       ,
   instr_entretien,
   tip_ins_code)

select distinct 
   instr_code,
   ate_id            ,
   tsr_repart_code   ,
   rpc_statut        ,
   type_instruction  ,
   rese_ident        ,
   cont_num          ,
   nom               ,
   cont_anbas        ,
   cont_sembas       ,
   null              ,
   getdate()         ,
   null              ,
   @log_acteur,
   @entretien,
   0
from #instruction_train
where statut = 'N'
and type_instruction in ( 'contrat', 'reseau')
and not exists ( select 1 from instruction_train where #instruction_train.instr_code = instruction_train.instr_code)

-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'instruction_train alors ?', @log_acteur
        return 1
	end



/*************************
 * Cas mise ? jour d'instruction
 ******************** */
update instruction_train
set  instruction_train.instr_dat_maj  = getdate(),
     instruction_train.instr_user     = @log_acteur ,
     instruction_train.rpc_statut     =  1,
     instruction_train.instr_annonceur = #instruction_train.nom
from instruction_train, #instruction_train
where instruction_train.instr_code   =  #instruction_train.instr_code       
        and statut = 'M'
        and instruction_train.rpc_statut not in (5,2,4)

-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'update instruction_train 1', @log_acteur
        return 1
	end

/********************************
 * maj instuctions les visuels
*************************** */

update #instruction_train
set statut_visuels = 'M'
from instruction_visuels, #instruction_train
where 
statut_visuels is null
and statut = 'M'
and instruction_visuels.instr_code = #instruction_train.instr_code
and instruction_visuels.insv_afch_ident = #instruction_train.afch_ident

 
-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'modif instructions visuels', @log_acteur
        return 1
	end

-- sinon premi?re instruction statut en cours tsr_repart_code.
update #instruction_train 
set statut_visuels = 'N'
where statut_visuels is null

-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'New visuels', @log_acteur
        return 1
	end
 
 -- insertion des lignes.
insert into instruction_visuels (
  instr_code ,
  sup_id     ,
  tpr_id    ,
  rpc_statut,
  insv_afch_ident,
  insv_theme_ori,
  insv_pourcentage_ori,
  insv_theme,
  insv_pourcentage,
  insv_dat_cre,
  insv_user)
  
select distinct 
  instr_code,
  sup_id,
  tpr_id,
  rpc_statut,
  afch_ident,
  theme,
  pourcentage,
  theme,
  pourcentage,
  getdate(),
  @log_acteur
 from #instruction_train
where statut_visuels = 'N'
and exists ( select 1 from instruction_train
where #instruction_train.instr_code = instruction_train.instr_code )


-- pour la gestion des anomalies

    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'instruction_visuels', @log_acteur
        return 1
	end

-- Pour le moment, on annule et remplace.
delete from #instruction_train where  statut_visuels = 'D'

-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'delete instruction_visuels', @log_acteur
        return 1
	end
 
update instruction_visuels
set insv_theme_ori = theme,
insv_pourcentage_ori = pourcentage,
insv_theme = theme,
insv_pourcentage = pourcentage
from #instruction_train, instruction_visuels
where 
instruction_visuels.instr_code = #instruction_train.instr_code
and instruction_visuels.insv_afch_ident = #instruction_train.afch_ident
and statut_visuels = 'M'

-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, ' maj instruction_visuels', @log_acteur
        return 1
	end

/**********************************
 * traitement des lignes de train
 ***************************** */

-- mise ? jour des r?servations : statut passe ? 1.        
Update tf_face_train
set tf_face_train.rpc_statut =  1, ft_dat_maj = getdate(), ft_user_maj = @log_acteur
from tf_face_train, #instruction_train
where tf_face_train.rpc_statut  in ( 0, 3)
and tf_face_train.instr_code = #instruction_train.instr_code

-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'tf_face_train', @log_acteur
        return 1
	end
      
-- select * from #instruction_train

------------------------------------------------------
----Les instructions ? la face : annule et remplace.
------------------------------------------------------

select distinct
    origine,	
    cont_num,	
    cadr_ident,	
    cdep_datdep,	
    date_ligne,
    sect_code,	
    valeur	,
    rese_ident,	
    depa_code	,
    aggl_numord	,
    afch_ident,	
    theme	,
    sect_code_centre	,
    form_larg	,
    form_haut	,
    tyaf_code	,
    talr_trait,
    convert    (varchar (20),  null)  'type_instruction' ,
    isnull( cont_anbas,0) cont_anbas,
    isnull( cont_sembas,0) cont_sembas,
    convert    (varchar(18),  null) instr_code,
    convert    (smallint,  null) ate_id,
    convert    (smallint,  null) tpr_id,
    convert    (tinyint,  null) tsr_repart_code,
    convert    (tinyint,  null) rpc_statut,
    convert    (char,  null)  'statut',
    convert    (char,  null)  'statut_visuels',
    convert (smallint,  null)  'sup_id',
    cadre_lib
    into #instruction_detail
	from tra_amt_log_instruc_det
    where sect_code_centre is not null
    and talr_trait = '1'
    

-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, '#instruction_detail', @log_acteur
        return 1
	end

-- atelier
-- 8m2 scro wissous
update #instruction_detail
set ate_id = 7
where sect_code_centre = 32
and form_larg = 306
 
-- 8m2 scro N?mes
update #instruction_detail
set ate_id = 8
where sect_code_centre = 34
and form_larg = 306

-- 2m2 scro wissous
update #instruction_detail
set ate_id = 5
where sect_code_centre = 32
and ate_id is null

-- 2m2 scro wissous
update #instruction_detail
set ate_id = 6
where sect_code_centre = 34
and ate_id is null


--Type de pr?paration
--12	RX8
update #instruction_detail
set tpr_id = 12
where tyaf_code = 615 

--11	V?nusial
update #instruction_detail
set tpr_id = 11, sup_id = 1026
where tyaf_code in (650, 660)

--10	Scro
update #instruction_detail
set tpr_id = 10 
where tpr_id is null

-- les bandeaux
update #instruction_detail
set tpr_id = 2
where tyaf_code = 2


--on ne concerve que support
update #instruction_train set sup_id = null

update #instruction_detail 
set instr_code = convert (varchar (4),cont_anbas) + right ('0' + convert (varchar (4),cont_sembas),2) + 'C'+ right ('0' +convert ( varchar ,ate_id),2) + right ('000000000' +convert ( varchar ,cont_num),9)
where cont_num is not null

/*
update #instruction_detail 
set instr_code = convert (varchar (4),cont_anbas) + right ('00',2) + 'C'+ right ('0' +convert ( varchar ,ate_id),2) + right ('000000000' +convert ( varchar ,cont_num),9)
where cont_num is not null
*/

update #instruction_detail 
set instr_code = convert (varchar (4),cont_anbas) + right ('0' + convert (varchar (4),cont_sembas),2) + 'R'+ right ('0' +convert ( varchar ,ate_id),2) + right ('000000000' +convert ( varchar ,rese_ident),9)
where  cont_num is null

delete from instruction_detail where instr_code in 
(select instr_code from #instruction_detail )


-- SJA => Pas d'int�gration AMT sup � S06 2018
--delete 
--from #instruction_detail
--where 
--instr_code  > '201806'

-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'delete instruction_detail', @log_acteur
        return 1
	end


insert into instruction_detail (
  instr_code          ,
  insd_cadr_ident     ,
  insd_cadre_lib      ,
  sup_id              ,
  tpr_id              ,
  insd_afch_ident     ,
  insd_theme          ,
  insd_repiquage_ident,
  insd_repiquage      ,
  insd_type           ,
  insd_dat_cre        ,
  ins_dat_maj         ,
  insd_user           )

select distinct  instr_code,cadr_ident, isnull(cadre_lib,origine) , sup_id, tpr_id, afch_ident, theme, null,null,origine, getdate(), null, @log_acteur
 from #instruction_detail
 where  tpr_id <> 2
and exists ( select 1 from instruction_train
where #instruction_detail.instr_code = instruction_train.instr_code )


-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'insert instruction_detail', @log_acteur
        return 1
	end

-- les bdx
insert into instruction_detail (
  instr_code          ,
  insd_cadr_ident     ,
  insd_cadre_lib      ,
  sup_id              ,
  tpr_id              ,
  insd_afch_ident     ,
  insd_theme          ,
  insd_repiquage_ident,
  insd_repiquage      ,
  insd_type           ,
  insd_dat_cre        ,
  ins_dat_maj         ,
  insd_user           )

select distinct instr_code,cadr_ident, isnull(cadre_lib, origine), sup_id, tpr_id, null,null,afch_ident, theme,origine, getdate(), null, @log_acteur
 from #instruction_detail
 where tpr_id = 2
and exists ( select 1 from instruction_train
where #instruction_detail.instr_code = instruction_train.instr_code )

--select * from #instruction_detail
update tra_amt_log_instruction set talr_trait = 'T' where talr_trait = '1'

-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'tra_amt_log_instruction fin', @log_acteur
        return 1
	end
        
    
-- maj entretien par d?faut.
update instruction_train set instr_entretien = 8 where instr_entretien is null
    
-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'instruction_train entretien', @log_acteur
        return 1
	end
    
    
    
  
    
update tra_amt_log_instruc_det set talr_trait = 'T' where talr_trait = '1'

-- pour la gestion des anomalies
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'tra_amt_log_instruc_det fin', @log_acteur
        return 1
	end
return 0

END
;
;
;
;
GO
/****** Object:  StoredProcedure [dbo].[p_integ_ptf_purge]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER OFF
GO
CREATE proc [dbo].[p_integ_ptf_purge]
as
begin
	-- description : procedure pour supprimer les données de travail
	--		de l'alimentation de Circe
	--
	-- Wheeler A.	| 2014.11.06	| creation
	
	-- comme il peut y avoir des insertions de données entre la lecture des données par le lot SSIS
	-- l'integration de ses données dans ptf et la suppression de celle-ci sur bdamt
	-- on identifie les données à integrer dans ptf avec la colonne talr_trait à 'B' pour blocage
	-- ses données une fois traiter sont flager à 'T'

-- SJA 29/03/2016 : IT 34650 on force le vidage pour éviter les  erreurs de doublons end répart.

	-- suppression des données
--	delete from tw_amt_log_repart where talr_trait = 'T'
--	delete from tw_amt_log_destination
	--delete from tra_amt_log_instruction where talr_trait = 'T'
	--delete from tra_amt_log_instruc_det where talr_trait = 'T'
	--delete from tra_amt_log_statut_repart where talr_trait = 'T'
	--delete from tra_amt_log_train where talr_trait = 'T'

    delete from tw_amt_log_repart 
	delete from tw_amt_log_destination
	delete from tra_amt_log_instruction 
	delete from tra_amt_log_instruc_det 
	delete from tra_amt_log_statut_repart
	delete from tra_amt_log_train 

    update tf_UM set tf_UM.UM_qte = 1 where tf_UM.UM_qte = 0
  
	-- fin de la procedure
	return 0
end
GO
/****** Object:  StoredProcedure [dbo].[p_integ_ptf_reparts]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


CREATE PROCEDURE [dbo].[p_integ_ptf_reparts]
AS
BEGIN
-------------------------------------------------------------------------------
--  Procédure            : p_integ_ptf_reparts
--  Auteur               : PDUC
--  Date de création     : 04/07/07
--  Description 	 : phase 2 du traitement des répartitions -
--				intégration des lignes de repartition et destinations à traiter
--				contenues dans les tables log PTF
--				dans les tables fonctionnelles ptf (calcul repart, destinations)
--				et génération des anomalies sur les répartitions
--  Auteur - Date - Nature modif. :
--  	AMS - 05/07/07 - ...
--		ELE - 18/06/09 - bt 3781 : suppression doublons dans tf_repart_calcul et
--									log des tentatives d'insertion de doublons
--									Traitement d'erreur sur insert dans cette table
--  Paramètres d'entrée  :      -
--  Paramètres de sortie :      -
--  Retour 		 : 	(=0 : OK) ; (!=0 - erreur fonctionnelle ou serveur)
-------------------------------------------------------------------------------
-- 2013.09.17	| Wheeler A.	| integration du personnel dans le calcul de repartition
-- 2014.11.07	| Wheeler A.	| evo 39 lot 8 maj pour la maj du scenario lot SSIS

	declare @error				int,
	 		@sup_id 			smallint,
			@des_id 			numeric(9),
			@des_type 			smallint,
			@tpr_id				smallint,
			@act_id 			smallint,
			@ate_id 			smallint,
			@rpc_id 			numeric(9),
			@des_type_adr		tinyint,
			@tw_id 				numeric(9),
			@statut 			tinyint,
			@log_module			varchar(50),
			@log_acteur			varchar(50),
			@des_nom			varchar(50),
			@des_adr1			varchar(50),
			@des_postal			char(5),
			@des_localite		varchar(50),
			@des_id_current		numeric(9),
			@des_type_current	tinyint,
			@des_adr_current	tinyint,
			@des_mail			varchar(30),
            @dest_id            int


	-- initialisation
	select @log_module = OBJECT_NAME(@@PROCID),
	@log_acteur = 'batch'

    -- intégration des destinataires
    exec p_integ_ptf_des
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'erreur maj destinataire', @log_acteur
	return 0
    end
    
    
	-- pour la gestion des anomalies
	create table #ano
	(
		tan_id 		numeric(9,0) null,
		ano_valeur 	numeric(9,0) null
	)

	-- des lignes déjà en base 
	if exists (	select 1 
				from tf_repart_calcul rc,
					tw_amt_log_repart r
				where rc.rpc_rpfo_ident = r.rpfo_ident
				and rc.rpc_statut <> 4 )
	begin
		insert tt_log (log_date, log_module, log_desc)
		select distinct getdate(), 'batch', 'Doublon envoie : ' + convert(varchar,tf_repart_calcul.rpc_rpfo_ident)
		from tf_repart_calcul, tw_amt_log_repart
		where tf_repart_calcul.rpc_rpfo_ident =  tw_amt_log_repart.rpfo_ident
		and tf_repart_calcul.rpc_statut <> 4

		-- doublon de répartition on ne pousse pas la data
		delete tw_amt_log_repart
		from tf_repart_calcul rc,
			tw_amt_log_repart r
		where rc.rpc_rpfo_ident = r.rpfo_ident
		and rc.rpc_statut <> 4
	end

	-- creation des repartitions
	create table #repart
	(
		tw_id			numeric(9,0) IDENTITY(1,1) NOT NULL,
		repa_ident		numeric(9,0) NOT NULL,
		rpfo_ident		numeric(9,0) NOT NULL,
		pers_ident		numeric(9,0) NULL,
		tyaf_code		smallint NOT NULL,
		pers_nom		varchar(50) NULL,
		tald_type		char(2) NOT NULL,
		tald_soci_code	tinyint NOT NULL,
		tald_code		numeric(9,0) NOT NULL,
		reac_code		tinyint NOT NULL,
		typr_code		tinyint NOT NULL,
		rpli_datdep		smalldatetime NOT NULL,
		rpli_anbas		smallint NOT NULL,
		rpli_sembas		tinyint NOT NULL,
		soci_code		tinyint NOT NULL,
		sect_code		smallint NOT NULL,
		afch_ident		numeric(9,0) NOT NULL,
		afch_lib		varchar(255) NOT NULL,
		cont_annonc		varchar(30) NULL,
		rpty_qte_affich int NULL,
		talr_trait		char(1) NULL,
		cont_num		int null,
		rpc_san_rep		char(1) null
	)

	-- copie des données
	insert #repart(
		repa_ident,
		rpfo_ident,
		pers_ident,
		tyaf_code,
		pers_nom,
		tald_type,
		tald_soci_code,
		tald_code,
		reac_code,
		typr_code,
		rpli_datdep,
		rpli_anbas,
		rpli_sembas,
		soci_code,
		sect_code,
		afch_ident,
		afch_lib,
		cont_annonc,
		rpty_qte_affich,
		talr_trait,
		cont_num
	)
	select repa_ident,
		rpfo_ident,
		pers_ident,
		tyaf_code,
		pers_nom,
		tald_type,
		tald_soci_code,
		tald_code,
		reac_code, 
		typr_code,
		rpli_datdep,
		rpli_anbas,
		rpli_sembas,
		soci_code,
		sect_code,
		afch_ident,
		afch_lib,
		cont_annonc,
		rpty_qte_affich,
		talr_trait,
		cont_num
	from tw_amt_log_repart

	-- on ecrase le tyaf_code par le code du type de preparation logistique
	update #repart
	set tyaf_code = t.tpr_id
	from #repart r
	join tr_typ_aff_amt t on (r.tyaf_code = t.taf_amt)

	-- on regroupe les données de repartition avec l'afficheur (i.e. pers_ident et pers_nom)
	insert #repart(repa_ident,
		rpfo_ident,
		tyaf_code,
		tald_type,
		tald_soci_code,
		tald_code,
		reac_code,
		typr_code,
		rpli_datdep,
		rpli_anbas,
		rpli_sembas,
		soci_code,
		sect_code,
		afch_ident,
		afch_lib,
		cont_annonc,
		rpty_qte_affich,
		talr_trait,
		cont_num,
		pers_ident,
		pers_nom)
	select repa_ident,
		rpfo_ident,
		tyaf_code,
		tald_type,
		tald_soci_code,
		tald_code,
		reac_code,
		typr_code,
		rpli_datdep,
		rpli_anbas,
		rpli_sembas,
		soci_code,
		sect_code,
		afch_ident,
		afch_lib,
		cont_annonc,
		sum(rpty_qte_affich),
		1,
		cont_num,
		pers_ident,
		pers_nom
	from #repart
	where talr_trait = 'B'
	group by repa_ident,
		rpfo_ident,
		tyaf_code,
		tald_type,
		tald_soci_code,
		tald_code,
		reac_code,
		typr_code,
		rpli_datdep,
		rpli_anbas,
		rpli_sembas,
		soci_code,
		sect_code,
		afch_ident,
		afch_lib,
		cont_annonc,
		cont_num,
		pers_ident,
		pers_nom
	
	-- traitement nouvelles répartitions à intégrer (statut is null)
	-- rq : on prend les lignes regroupés (tal_trait = '1')
	declare cur_integ_repart cursor for
	select r.typr_code,
		r.tald_code,
		case r.tald_type	when 'LB'	then 0
							when 'SA' 	then 2
										else 1
							end,
		r.tyaf_code,
		r.reac_code,
		a.ate_id,
		r.tw_id
	from #repart r
	join tr_atelier a on (r.sect_code = a.ate_code_amt)
	where r.talr_trait = '1'
	for read only

	open cur_integ_repart

	fetch next from cur_integ_repart into
		@sup_id,
		@des_id,
		@des_type,
		@tpr_id,
		@act_id,
		@ate_id,
		@tw_id

	while @@fetch_status = 0
	begin
		-- gestion de(s) anomalie(s) sur la répartition
		-- maj du statut : passera a 3 si au moins une anomalie détectée
		select @statut = 0

		-- lecture du destinataire
		select @dest_id = dest_id 
		from tr_destinataire where
		des_id = @des_id
		and des_type = @des_type

		if @dest_id is null
		begin
			insert #ano (tan_id, ano_valeur)
			values (903, @des_id)

			select @error = @@error
			if @error != 0
			begin
				insert tt_log (log_date, log_module, log_desc, log_acteur)
				select GETDATE(), @log_module, 'ano 903', @log_acteur
			end
		end
		
		-- Verification support
		if not exists (	select 1
						from tr_categorie_support
						where sup_id = @sup_id)
		begin
			insert #ano (tan_id, ano_valeur)
			values (905, @sup_id)

			select @error = @@error
			if @error != 0
			begin
				insert tt_log (log_date, log_module, log_desc, log_acteur)
				select GETDATE(), @log_module, 'ano 905', @log_acteur
			end

			select @sup_id = 0,
				@statut = 3
		end

		-- Verification type preparation 
		if not exists (	select 1
						from tr_type_preparation
						where tpr_id = @tpr_id)
		begin
			insert #ano (tan_id, ano_valeur)
			values (906, @tpr_id)

			select @error = @@error
			if @error != 0
			begin
				insert tt_log (log_date, log_module, log_desc, log_acteur)
				select GETDATE(), @log_module, 'ano 906', @log_acteur
			end

			select @tpr_id = 0,
				@statut = 3
		end

		-- Verification type atelier
		if not exists (	select 	1
						from tr_atelier
						where ate_id = @ate_id)
		begin
			insert #ano (tan_id, ano_valeur)
			values (907, @ate_id)

			select @error = @@error
			if @error != 0
			begin
				insert tt_log (log_date, log_module, log_desc, log_acteur)
				select GETDATE(), @log_module, 'ano 907', @log_acteur
			end

			select @ate_id = 0,
				@statut = 3
		end
		else
		begin
			-- insertion répartition
			insert tf_repart_calcul(
				sup_id,
				ate_id,
				soc_id,
				sem_num,
				sem_annee,
				tpr_id,
				act_id,
				rpc_type,
				rpc_repartition,
				rpc_annonceur,
				rpc_theme,
				rpc_num_aff_amt,
				rpc_qte,
				rpc_dat_aff,
				rpc_statut,
				rpc_rpfo_ident,
				rpc_user,
				cont_num,
				rpc_san_rep,
				pers_ident,
				pers_nom,
				rpc_dat_cre,
				rpc_dat_maj,
				dest_id)
			select @sup_id,
				@ate_id,
				a.soci_code,
				datepart( ISO_WEEK, rpli_datdep),
				rpli_anbas,
				@tpr_id,
				@act_id,
				0,
				repa_ident,
				cont_annonc,
				substring(afch_lib,1, 50),
				afch_ident,
				rpty_qte_affich,
				rpli_datdep,
				@statut,
				rpfo_ident,
				'user_ptf',
				cont_num,
				rpc_san_rep,
				pers_ident,
				pers_nom,
				getdate(),
				getdate(),
				@dest_id
			from #repart a
			where tw_id = @tw_id

			select @rpc_id = @@identity, @error = @@error

			if @error != 0
			begin
				insert tt_log (log_date, log_module, log_desc, log_acteur)
				select GETDATE(), @log_module, 'erreur insertion tr_repart_calcul', @log_acteur
			end

			-- gestion d'erreur
			if @rpc_id = 0 or @error <> 0
			begin
				update tw_amt_log_repart
				set talr_trait = 'E'
				from #repart r
				join tw_amt_log_repart t on (r.repa_ident = t.repa_ident
											and r.rpfo_ident = t.rpfo_ident
											and r.tald_type = t.tald_type
											and r.tald_soci_code = t.tald_soci_code
											and r.tald_code = t.tald_code
											and r.reac_code = t.reac_code
											and r.typr_code = t.typr_code
											and r.rpli_datdep = t.rpli_datdep
											and r.rpli_anbas = t.rpli_anbas
											and r.rpli_sembas = t.rpli_sembas
											and r.soci_code = t.soci_code
											and r.sect_code = t.sect_code
											and r.afch_ident = t.afch_ident
											and r.cont_annonc = t.cont_annonc
											and r.cont_num = t.cont_num
											and r.rpty_qte_affich = t.rpty_qte_affich)
				join tr_typ_aff_amt a on (r.tyaf_code = a.tpr_id
											and a.taf_amt = t.tyaf_code)
				where r.tw_id = @tw_id
			end
		end

		-- insertion anomalie(s) sur répartition
		insert tf_anomalies(
			rpc_id,
			tan_id,
			ano_valeur,
			ano_user,
			ano_dat_cre,
			ano_dat_maj)
		select @rpc_id,
			tan_id,
			ano_valeur,
			'user_ptf',
			getdate(),
			getdate()
		from #ano t
		where not exists (	select 1
							from tf_anomalies a
							where a.rpc_id = @rpc_id
							and  t.tan_id = a.tan_id)

		select @error = @@error
		if @error != 0
		begin
			insert tt_log (log_date, log_module, log_desc, log_acteur)
			select GETDATE(), @log_module, 'erreur insertion des anomalies', @log_acteur
		end

		delete #ano

		select @error = @@error
		if @error != 0
		begin
			insert tt_log (log_date, log_module, log_desc, log_acteur)
			select GETDATE(), @log_module, 'erreur suppression #ano', @log_acteur
		end

		FETCH NEXT FROM cur_integ_repart INTO @sup_id,
			@des_id ,
			@des_type ,
			@tpr_id	,
			@act_id ,
			@ate_id,
			@tw_id
	END --while fetch

	CLOSE cur_integ_repart

	DEALLOCATE cur_integ_repart

	-- mise à jour statut nouvelles répartitions en cours d'intégration (statut passe à 0)
	-- les nouvelles destinations une fois toutes intégrées seront validées intégrées en phase 3 (statut passe à 1)
	update tw_amt_log_repart
	set	talr_trait = 'T'
	where talr_trait = 'B'

	select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'erreur maj talr_trait', @log_acteur
	end

	-- liberation memoire
	drop table #ano
	drop table #repart

	-- fin de la procedure
	return 0
end


GO
/****** Object:  StoredProcedure [dbo].[p_integ_ptf_statut_repart]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[p_integ_ptf_statut_repart]
AS
BEGIN
-------------------------------------------------------------------------------
--  Proc�dure            : p_integ_ptf_statut_repart
--  Auteur               : SJAOEN
--  Date de cr�ation     : 18/10/2014
--  Description 	 : int�gration des statuts de repartition
--  Auteur - Date - Nature modif. :
--  Param�tres d'entr�e  :      -
--  Param�tres de sortie :      -
--  Retour 		 : 	(=0 : OK) ; (!=0 - erreur fonctionnelle ou serveur)
-------------------------------------------------------------------------------

	declare 
      @error				int,
      @log_module			varchar(50),
	  @log_acteur			varchar(50)

    -- initialisation
	select @log_module = OBJECT_NAME(@@PROCID),
		@log_acteur = 'batch'

	-- pour la gestion des anomalies
	create table #ano
	(
		tan_id 		numeric(9,0) null,
		ano_valeur 	numeric(9,0) null
	)
--SJA => on ne fait plus
return 0

	select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'erreur ano', @log_acteur
        return 1
	end


-- des lignes d�j� en base � taiter ?
------------------ Gestion des 
	-- creation des instructions
	-- copie des donn�es

update tra_amt_log_statut_repart set talr_trait = '1'

	select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'tra_amt_log_statut_repart 1', @log_acteur
        return 1
	end


select count (distinct statut) 'nb', repa_ident , date_statut, cont_num, 
               cont_datbas, cont_sembas,  min (statut) 'min'
into #t
from tra_amt_log_statut_repart
               where date_statut = ( select max (t2.date_statut) from  tra_amt_log_statut_repart t2
                                where tra_amt_log_statut_repart.repa_ident = t2.repa_ident )
               
group by repa_ident, date_statut,cont_num, 
               cont_datbas, cont_sembas

	select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 't', @log_acteur
        return 1
	end


--0	NA
--1	En cours
--2	Plateforme
--3	Commerce

Update instruction_train set tsr_repart_code = 3
from #t
where   #t.cont_num = instruction_train.cont_num
and     #t.cont_datbas = instruction_train.cont_anbas
and     #t.cont_sembas = instruction_train.cont_sembas
and #t.min = 0
and #t.nb =1

	select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'tsr_repart_code = 3', @log_acteur
        return 1
	end


Update instruction_train set tsr_repart_code = 2
from #t
where   #t.cont_num = instruction_train.cont_num
and     #t.cont_datbas = instruction_train.cont_anbas
and     #t.cont_sembas = instruction_train.cont_sembas
and #t.min = 1
and #t.nb =1

	select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'tsr_repart_code = 2', @log_acteur
        return 1
	end


Update instruction_train set tsr_repart_code = 1
from #t
where   #t.cont_num = instruction_train.cont_num
and     #t.cont_datbas = instruction_train.cont_anbas
and     #t.cont_sembas = instruction_train.cont_sembas
and #t.min = 0
and #t.nb =2
	select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'tsr_repart_code = 1', @log_acteur
        return 1
	end




update tra_amt_log_statut_repart set talr_trait = 'T' where talr_trait = '1'
	select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'tra_amt_log_statut_repart fin', @log_acteur
        return 1
	end


return 0




END
;
GO
/****** Object:  StoredProcedure [dbo].[p_integ_ptf_trains]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[p_integ_ptf_trains]
AS
BEGIN
-------------------------------------------------------------------------------
--  Procédure            : p_integ_ptf_trains
--  Auteur               : SJAOEN
--  Date de création     : 18/10/2014
--  Description 	 : intégration des trains.
--  Auteur - Date - Nature modif. :
--  Paramètres d'entrée  :      -
--  Paramètres de sortie :      -
--  Retour 		 : 	(=0 : OK) ; (!=0 - erreur fonctionnelle ou serveur)
-------------------------------------------------------------------------------
	
	declare 
    @error				int,
    @log_module			varchar(50),
	@log_acteur			varchar(50)

	-- initialisation
	select @log_module = OBJECT_NAME(@@PROCID),
	@log_acteur = 'AMT'

    -- intégration des destinataires
    exec p_integ_ptf_des
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'erreur maj destinataire', @log_acteur
	    return 1
    end

     -- intégration des trains à l'unité
    exec p_integ_ptf_cadre_trains
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'erreur maj faces de trains', @log_acteur
	return 1
    end

    -- intégration des instructions
    exec p_integ_ptf_instructions
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'erreur maj instructions', @log_acteur
	return 1
    end

    -- intégration des [dbo].[p_integ_ptf_statut_repart]
    exec p_integ_ptf_statut_repart
    select @error = @@error
	if @error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'erreur maj statut repart',@log_acteur
	return 1
    end


	-- fin de la procedure
	return 0
END
GO
/****** Object:  StoredProcedure [dbo].[p_integ_train_affiches]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE procedure [dbo].[p_integ_train_affiches]
(
	@getdate datetime,
	@result int output
)
AS
begin
	--  description : proc d'integration des donn?es de preparation
	--				2m2 fixe et pliage
	--
	-- 2017-03-01	| Wheeler A.	| creation
		
	-- initialisation resultat
	-- 0 => ok
	-- 1 => erreur
	select @result = 0

	declare @currentweek int;
	declare @currentyear int;

	select @currentweek = datepart(ww, getdate()) 
	select @currentyear = datepart(yy, getdate()) 


	-- creation table de travail
	select 
		tf.*,
		CAST(NULL AS int) AS IdFormat,
		CAST(NULL AS int) AS IdEspace,
		CAST(NULL AS varchar(50)) AS EspaceNom, 
		'' AS IdTypeDestinationDA 
	into #temp 
	from tf_face_train tf 
	where 1 = 2

	-- on initialise les donn?es
	insert #temp (IdFaceOTAffichage, rpc_statut, cadr_ident, cadre_lib, rdep_datdep, empl_ident, 
		pers_ident, pers_nom, cont_anbas, cont_sembas, cont_num, cont_annonc, agreement, train, rang, panel_ident, 
		dep_anbas, dep_sembas, ft_type, pre_assemblage, instr_code,empl_sect_code,Conservation,CoteCote,IdFormat,IdEspace,EspaceNom,
		Convention,RefConvention,IdTypeDossier,IdStructure,IdLienCoteCote,IdPanelDestination,RefPanel,IdProduit, IdTypeDestinationDA, IdJourDepart)
	select IdFaceOTAffichage, 0, IdFace, RefFace, DateDepart, IdLocalisation,
		IdRessource, left(ltrim(isnull(Nom, '')+ ' '+ isnull(Prenom, '')), 50), AnneeSemaine, 
		Semaine, IdDossierDeVenteChapeau, left(AnnonceurLibelle, 30), EspaceNom, NumeroOrdre, PositionTrainOrigine, IdPanel, 
		AnneeSemaine, Semaine, 'Face', 0, '',RegionCCF,Conservation,CoteCote,IdFormat,IdEspace,EspaceNom,Convention,RefConvention,IdTypeDossier,
		IdStructure,IdLienCoteCote,IdPanelDestination,RefPanel,IdProduit,IdTypeDestinationDA, IdJourDepart
	from trav_trainAffiche
	where Traitement = 'E' and IdTypeDestinationDA is not null

	-- destinataire
	-- mise ? jour du dest_id en fonction du type de destinataire
	-- a reworker en une seule passe si une seule colonne

	select dest_id, des_PexId,dest.des_type,ty.IdTypeDestinationDA
	into #trav_desti
	from tr_destinataire dest
	join tr_type_destination ty on dest.des_type = ty.des_type


	update #temp
	set dest_id = d.dest_id
	from #temp t
	join trav_trainAffiche a on (t.IdFaceOTAffichage = a.IdFaceOTAffichage)
	join #trav_desti d on (a.IdDestinataire = d.des_PexId and t.IdTypeDestinationDA = d.IdTypeDestinationDA)
	where a.IdTypeDestinationDA IN (2,3,4,5)
	
	-- atelier
	update #temp
	set ate_id = case	when a.IdSurface = 5 and a.IdSiteCCF = 39 then 5 -- 2m2 scro wissous
						when a.IdSurface = 5 and a.IdSiteCCF = 40 then 6 -- 2m2 scro nimes
						when a.IdSurface = 7 and a.IdSiteCCF = 39 then 7 -- 8m2 scro wissous
						when a.IdSurface = 7 and a.IdSiteCCF = 40 then 8 -- 8m2 scro nimes
						when a.IdSurface = 6 and a.IdSiteCCF = 39 then 11 -- 4m2 scro wissous
						when a.IdSurface = 6 and a.IdSiteCCF = 40 then 12 -- 4m2 scro nimes
						else 0
				 end
	from #temp t
	join trav_trainAffiche a on (t.IdFaceOTAffichage = a.IdFaceOTAffichage)
	
	-- support
	update #temp
	set sup_id = tcs.sup_id,
		typr_code = tp.tpr_id
	from #temp t
	join trav_trainAffiche a on (t.IdFaceOTAffichage = a.IdFaceOTAffichage)
	join TypePreparation tp on (a.IdTypePreparation = tp.IdTypePreparation)
	join transcoCategSupport tcs on (tp.tpr_id = tcs.tpr_id
										and a.IdSurface = tcs.IdSurface
										and tcs.estBandeau = 0)
	-- decodage emplacement
	update #temp
	set empl_depa_code = substring(RefFace, 1, 2),
		CodeUniteUrbaine = substring(RefFace, 4, 3),
		comm_numord = substring(RefFace, 8, 3),
		empl_numord = substring(RefFace, 12, 4),
		empl_addresse1 = left(ltrim(isnull(a.NumeroDeVoie, '')+' '+isnull(a.TypeVoieLibelle, '')+' '+isnull(a.Voie,'')), 30),
		empl_addresse2 = left(ltrim(a.LieuDit), 30),
		empl_addresse3 = left(ltrim(a.PointDeRemise), 30),
		commune = a.Localite,
		cadr_lettre = right(RefFace, 1)
	from #temp t
	join trav_trainAffiche a on (t.IdFaceOTAffichage = a.IdFaceOTAffichage)

	-- code d'instruction
	update #temp
	set instr_code = convert(varchar,dep_anbas)+
    --convert(varchar,dep_sembas)+
    right ('0' + convert (varchar (4),dep_sembas),2) +
    'C0'+RIGHT('0' + CONVERT(VARCHAR(2), ate_id), 2)+right('00000000'+convert(varchar,cont_num), 8)
	
		-- Panel a traiter
	select tf.train_id ,tf.RefPanel, tf.cont_anbas, tf.cont_sembas,t.dest_id,t.pers_nom, t.pers_ident,tf.rdep_datdep
	into #PanelATraiter 
	from tf_face_train tf
		join #temp t on t.IdFaceOTAffichage = tf.IdFaceOTAffichage
	and tf.rpc_statut <= 4
	group by tf.train_id,tf.RefPanel, tf.cont_anbas, tf.cont_sembas, t.dest_id,t.pers_nom,t.pers_ident,tf.rdep_datdep
    
    -- pas d'integration des preparations pretes. 
    -- SJA - 20160418
    delete #temp from 
    #temp, instruction_train
    where #temp.instr_code = instruction_train.instr_code
    and instruction_train.rpc_statut not in (0,1)

    
-- suppression des anciennes r�servation. � faire par contrat/semaine/statut.
   delete from tf_face_train
    from tf_face_train, #temp
    where  
-- tf_face_train.instr_code in (select distinct instr_code from #train)
    exists (select 1 from #temp t2
        where tf_face_train.cont_sembas = t2.cont_sembas
        and tf_face_train.cont_anbas = t2.cont_anbas
        and tf_face_train.cont_num = t2.cont_num
    )
    and tf_face_train.rdep_datdep > getdate()
    and tf_face_train.rpc_statut in (0,1,3,4)


	--pour les résa derniere minute, il faut s'assurer que les trains prennet la meme ressources que pour ceux qui sont déja dans CIRCE
	update t
	set t.pers_ident = t2.pers_ident ,
	t.pers_nom = t2.pers_nom,
	t.dest_id = t2.dest_id
	from
	#temp t
	left  join tf_face_train f on (t.IdFaceOTAffichage = f.IdFaceOTAffichage and t.RefPanel = f.RefPanel)
	join tf_face_train t2 on t.RefPanel = t2.RefPanel and t.cont_anbas = t2.cont_anbas and t.cont_sembas = t2.cont_sembas 
	where t2.rpc_statut in (2,5,6,7,8,9,10)
	and f.IdFaceOTAffichage is null

    
	-- on fait les mises ? jours en base pour les donn?es existantes
	update tf_face_train
	set --dest_id = t.dest_id,
		rpc_statut = t.rpc_statut,
		ate_id = t.ate_id,
		sup_id = t.sup_id,
		instr_code = t.instr_code,
		cadr_ident = t.cadr_ident,
		cadre_lib = t.cadre_lib,
		rdep_datdep = t.rdep_datdep,
		empl_ident = t.empl_ident,
		--pers_ident = t.pers_ident,
		--pers_nom = t.pers_nom,
		typr_code = t.typr_code,
		cont_sembas = t.cont_sembas,
		cont_anbas = t.cont_anbas,
		cont_num = t.cont_num,
		cont_annonc = t.cont_annonc,
		empl_depa_code = t.empl_depa_code,
		comm_numord = t.comm_numord,
		empl_numord = t.empl_numord,
		empl_addresse1 = t.empl_addresse1,
		empl_addresse2 = t.empl_addresse2,
		empl_addresse3 = t.empl_addresse3,
		cadr_lettre = t.cadr_lettre,
		agreement = t.agreement,
		train = t.train,
		rang = ISNULL(t.rang,10),
		panel_ident = t.panel_ident, 
		ft_dat_maj = @getdate,
		ft_user_maj = suser_name(),
		commune = t.commune,
		dep_sembas = t.dep_sembas, 
		dep_anbas = t.dep_anbas,
		ft_type = t.ft_type, 
		pre_assemblage = t.pre_assemblage,
		empl_sect_code = t.empl_sect_code,
		Conservation = t.Conservation,
		CoteCote = t.CoteCote,
		IdProduit = t.IdProduit,
		--form_larg et form_haut  depuis ID Format => soit 120x176 pour le 2, soit 306x223 pour le 8m2
		form_larg =  CASE  
                        WHEN t.IdFormat = 7 THEN 120 
                        WHEN t.IdFormat = 10 THEN 306 
						WHEN t.IdFormat = 282 THEN 160
                       ELSE NULL
                    END ,
		form_haut =  CASE  
                        WHEN t.IdFormat = 7 THEN 176 
                        WHEN t.IdFormat = 10 THEN 223 
						WHEN t.IdFormat = 282 THEN 240
                       ELSE NULL
                    END,
					rese_ident = t.IdEspace,
					idre_nom = t.EspaceNom,
					Convention = t.Convention,
					RefConvention = t.RefConvention,
					IdTypeDossier = t.IdTypeDossier,
					IdStructure = t.IdStructure,
					IdLienCoteCote = t.IdLienCoteCote,
					IdPanelDestination = t.IdPanelDestination,
					RefPanel = t.RefPanel,
		IdJourDepart = t.IdJourDepart

	from #temp t
	join tf_face_train f on (t.IdFaceOTAffichage = f.IdFaceOTAffichage)
	-- SJA
	where f.rpc_statut in ( 0, 1)

	CREATE TABLE #inserted (IdFaceOTAffichage int, idPanel int, semaine int, annee int, pers_ident numeric(9,0), pers_nom varchar(50), dest_id int)
    
	-- sinon on les inseres
	-- on utilise left join car plus rapide que not exist
	-- voir si c'est plus propre avec un merge
	insert tf_face_train (dest_id, rpc_statut, ate_id, sup_id, instr_code, cadr_ident, cadre_lib, rdep_datdep,
		empl_ident, pers_ident, pers_nom, typr_code, cont_sembas, cont_anbas, cont_num, cont_annonc,
		empl_depa_code, comm_numord, empl_numord, empl_addresse1, empl_addresse2, empl_addresse3, cadr_lettre, agreement,
		train, rang, panel_ident, ft_dat_cre, ft_user_maj, commune, dep_sembas, dep_anbas, ft_type, 
		pre_assemblage, IdFaceOTAffichage, CodeUniteUrbaine,empl_sect_code,Conservation,CoteCote,form_larg,form_haut,rese_ident,idre_nom,
		Convention,RefConvention,IdTypeDossier,IdStructure,IdLienCoteCote,IdPanelDestination,RefPanel,IdProduit, IdJourDepart)
	OUTPUT INSERTED.IdFaceOTAffichage, INSERTED.panel_ident, INSERTED.cont_sembas , INSERTED.cont_anbas , INSERTED.pers_ident, INSERTED.pers_nom, INSERTED.dest_id
	INTO #inserted(IdFaceOTAffichage, idPanel, semaine, annee,pers_ident, pers_nom, dest_id)
	select t.dest_id, t.rpc_statut, t.ate_id, t.sup_id, t.instr_code, t.cadr_ident, t.cadre_lib, t.rdep_datdep,
		t.empl_ident, t.pers_ident, t.pers_nom, t.typr_code, t.cont_sembas, t.cont_anbas, t.cont_num, t.cont_annonc,
		t.empl_depa_code, t.comm_numord, t.empl_numord, t.empl_addresse1, t.empl_addresse2, t.empl_addresse3, t.cadr_lettre, t.agreement,
		t.train, isnull(t.rang, 10) , t.panel_ident, @getdate, suser_name(), t.commune, t.dep_sembas, t.dep_anbas, t.ft_type, 
		t.pre_assemblage, t.IdFaceOTAffichage, t.CodeUniteUrbaine, t.empl_sect_code,t.Conservation,t.CoteCote,
		 CASE  
                        WHEN t.IdFormat = 7 THEN 120 
                        WHEN t.IdFormat = 10 THEN 306 
						WHEN t.IdFormat = 282 THEN 160
                       ELSE NULL
                    END,
					 CASE  
                        WHEN t.IdFormat = 7 THEN 176 
                        WHEN t.IdFormat = 10 THEN 223 
						WHEN t.IdFormat = 282 THEN 240
                       ELSE NULL
                    END ,
		t.IdEspace,
		t.EspaceNom,
		t.Convention,
		t.RefConvention,
		t.IdTypeDossier,
		t.IdStructure,
		t.IdLienCoteCote,
		t.IdPanelDestination,
		t.RefPanel,
		t.IdProduit,
		t.IdJourDepart

	from #temp t
	left join tf_face_train f on (t.IdFaceOTAffichage = f.IdFaceOTAffichage)
	where f.IdFaceOTAffichage is null


	update tf set tf.pers_ident = ins.pers_ident
	, tf.pers_nom = ins.pers_nom, tf.dest_id = ins.dest_id
	from #inserted ins 
	join tf_face_train tf on ins.idPanel = tf.panel_ident and ins.semaine = tf.cont_sembas and ins.annee = tf.cont_anbas and tf.IdFaceOTAffichage != ins.IdFaceOTAffichage 
	where tf.rpc_statut in (0,1)
	
	-- on initialise les donn?es de la table instructions par defaut
	-- Ajout des chapeaux d'instuction manquants.(contrats)
	insert into instruction_train (instr_code, ate_id, tsr_repart_code, rpc_statut, 
		instr_type_instruction,	cont_num, instr_annonceur, cont_anbas, cont_sembas, instr_dat_cre, instr_user,Conservation,CoteCote)
	select distinct tf.instr_code, ate_id, 0, 0, 'contrat', cont_num, cont_annonc, cont_anbas, isnull(cont_sembas, 0), getdate(), 'BC',MaxTable.Conservation,MaxTable.CoteCote
	from tf_face_train tf
	LEFT JOIN (		select instr_code, MAX(Conservation) as Conservation,MAX(CoteCote) as CoteCote
	from tf_face_train
	GROUP BY instr_code) MaxTable on MaxTable.instr_code = tf.instr_code
	where cont_num is not null
	and not exists (select 1 
					from instruction_train
					where tf.instr_code = instruction_train.instr_code)
	and cont_anbas is not null

	-- pour la gestion des anomalies
	if @@error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select @getdate, object_name(@@procid), 'instruction_train 1 ', suser_name()
		return 1
	end

	-- mettre a jour Id produit
	update  t 
	set 
	t.IdProduit = tr.IdProduit
	from
	tf_face_train t
	join  trav_trainAffiche tr on t.IdStructure = tr.IdStructure
	where t.IdProduit is null and t.dep_sembas >= @currentweek and dep_anbas >= @currentyear

	update  tf_face_train
	set 
	IdProduit = 15
	where IdProduit is null and dep_sembas >= @currentweek and dep_anbas >= @currentyear


	-- update les ressources pour les trains en instructions OK
	--selectionner que les panel éligibles à la mise à jour
	select  tf.RefPanel,  tf.cont_anbas, tf.cont_sembas,tf.rdep_datdep
	into #tempPanelAGarder
	from tf_face_train tf
	join #PanelATraiter tr on tf.RefPanel = tr.RefPanel and tf.cont_anbas = tr.cont_anbas and tf.cont_sembas = tr.cont_sembas and tf.rdep_datdep = tr.rdep_datdep
	group by tf.RefPanel,  tf.cont_anbas, tf.cont_sembas, tf.rdep_datdep
	having SUM(distinct case  when rpc_statut <= 4 then 0 else 1 end ) = 0


	--selectionner le resultat
	select pt.*
	into #ResultatPanel
	from #tempPanelAGarder pg
	join #PanelATraiter pt on pg.RefPanel = pt.RefPanel and pg.cont_anbas = pt.cont_anbas and pg.cont_sembas = pt.cont_sembas and pg.rdep_datdep = pt.rdep_datdep


	-- Update les ressource 
	Update tf
	set tf.pers_nom = tr.pers_nom,
	tf.dest_id = tr.dest_id,
	tf.pers_ident = tr.pers_ident,
	ft_dat_maj	= GETDATE(),
	ft_user_maj	= 'UpdateRessource'
	from tf_face_train tf
	join #ResultatPanel tr on tf.RefPanel = tr.RefPanel and tf.cont_anbas = tr.cont_anbas and tf.cont_sembas = tr.cont_sembas and tf.rdep_datdep = tr.rdep_datdep

	

	-- archivage des donn?es
	insert histo_trainAffiche (Id, IdFaceOTAffichage, IdFace, RefFace, IdFormat, IdSurface, DateDepart, 
		IdLocalisation, IdStructure, IdPanel, IdRessource, Nom, Prenom, EstInterne, IdUniversContractuel, 
		IdTypePreparation, AnneeSemaine, Semaine, IdDossierDeVenteChapeau, IdAnnonceur, AnnonceurLibelle,
		IdTypeDestinationDA, IdDestinataire, IdAdresseDestinataire, IdAdressePat, IdTypeVoie, TypeVoieLibelle, 
		IdCommune, CommuneNom, NumeroDeVoie, Voie, BoitePostale, LieuDit, CodePostalLibre, Localite, IdPDVFace, 
		IdEspace, EspaceNom, NumeroOrdre, PositionTrainOrigine, PositionTrainModifie, IdSiteCCF, Traitement,
		DateTraitement, IdJourDepart)
	select Id, IdFaceOTAffichage, IdFace, RefFace, IdFormat, IdSurface, DateDepart, 
		IdLocalisation, IdStructure, IdPanel, IdRessource, Nom, Prenom, EstInterne, IdUniversContractuel, 
		IdTypePreparation, AnneeSemaine, Semaine, IdDossierDeVenteChapeau, IdAnnonceur, AnnonceurLibelle,
		IdTypeDestinationDA, IdDestinataire, IdAdresseDestinataire, IdAdressePat, IdTypeVoie, TypeVoieLibelle, 
		IdCommune, CommuneNom, NumeroDeVoie, Voie, BoitePostale, LieuDit, CodePostalLibre, Localite, IdPDVFace, 
		IdEspace, EspaceNom, NumeroOrdre, PositionTrainOrigine, PositionTrainModifie, IdSiteCCF, Traitement,
		@getdate, IdJourDepart
	from trav_trainAffiche

	drop table #trav_desti
	drop table #PanelATraiter
	drop table #tempPanelAGarder
	drop table #ResultatPanel

	return 0
end
;;
;

GO
/****** Object:  StoredProcedure [dbo].[P_MajParametre_Package]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
Create Procedure [dbo].[P_MajParametre_Package]
	@PackageName  nvarchar(50)
AS
BEGIN
	Update Parametre_Package Set DateMaj = GETDATE()
	WHERE Nom_Package = @PackageName
END
GO
/****** Object:  StoredProcedure [dbo].[p_s_adminSuiviRead]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[p_s_adminSuiviRead]
(
       @dep_anbas smallint,
       @dep_sembas  tinyint,
       @loginWindows varchar(50) null
)
AS
begin
       -- description : retourne les données pour l'ecran de suivi multi-plateformes
       --
       -- ---------------------------------------
       -- 2016.11.02   | Wheeler A.    | creation
       -- 2016.11.23   | Wheeler A.    | tfs 572 - prise en compte du filtre user
       -- 2017.09.20   | Rejany L.     | IT 50163 - Ajout des réparts sans UM créé, cad au staut "A traiter"
       -- 2017.09.29   | Jerbi O.      | récupération des dossiers réceptionnés et des stocks (affiche)
       -- 2018.01.05   | Jerbi O.      | récupération des colonnes affiche_id + validationAdmin + correction 
	   -- 2019.09.13   | Beno Y.       | récupération des bandeaux

       SET FMTONLY OFF

       create table #res
       (
             ate_id smallint null,
             ate_libelle varchar(150) null,
             cont_num int null,
             cont_annonc varchar(150) null,
             rpc_statut tinyint null,
             statut_nom varchar(150) null,
             sup_id smallint null,
             sup_nom varchar(150) null,
             theme varchar(150) null,
             repiquage varchar(150) null,
             quantite int null,
             isReceived bit null,
             affiche_Id int null,
             validationAdmin bit null
       )

   create table #livraisonReceived
   (
         cont_num int null,
         cont_annonc varchar(50) null,
		 plt_id int null,
         sup_id smallint null ,
         theme varchar(50) null,
         affiche_id int null,
         validationAdmin bit null,
         livraisonId int null,
         isReceived bit null,
   )

   -- get list of livraison received
     insert #livraisonReceived(cont_num,cont_annonc,plt_id,sup_id,theme,affiche_id,validationAdmin, livraisonId, isReceived)
       select  
             tf.cont_num,
             tf.rpc_annonceur,
			 tf.plt_id,
             tf.sup_id,
             tf.rpc_theme,
             aff.affiche_id,
             aff.validationAdmin,
             la.Id_livraison, 
              1
       from affiche aff
       join tf_prepa_affiche tf on aff.affiche_id = tf.affiche_livraison_Id 
       join asso_livraison_affiche la on (aff.affiche_id = la.Id_affiche_livraison)
         where aff.validationAdmin = 1 and (FromBroadcast = 0 or FromBroadcast is null)

       -- Sélection des répartitions
       -- On récupére le statut dans tf_UM ssi l'UM a été créé, cad qu'une correspondance avec rc.UM_id existe
       -- sinon c'est le statut dans tf_repart_calcul
       insert #res (ate_id, cont_num, cont_annonc, rpc_statut, sup_id, theme, quantite, isReceived, affiche_Id,repiquage)
       select 
             rc.ate_id,          
             rc.cont_num,
             rc.rpc_annonceur,
             case when u.rpc_statut IS NULL
                    THEN rc.rpc_statut
                    ELSE u.rpc_statut
             END,   
             rc.sup_id,   
             rc.rpc_theme, 
             sum(rc.rpc_qte),
             --sum(u.UM_qte),
             0,
             null,
			 rc.rpc_repiquage

       from tf_repart_calcul rc
                    left join tf_UM u on (u.UM_id = rc.UM_id)
                    join tr_utilisateur_data d on (rc.ate_id = d.ate_id)
       where rc.sem_annee = @dep_anbas
             and rc.sem_num = @dep_sembas
             and d.loginWindows = @loginWindows
       
       group by 
             rc.ate_id,   
             rc.cont_num,
             rc.rpc_annonceur,
             rc.rpc_statut,      
             u.rpc_statut, 
             rc.sup_id,
             rc.rpc_theme,
			 rc.rpc_repiquage


       -- Sélection des trains    
 		insert #res (ate_id, cont_num, cont_annonc, rpc_statut, sup_id, theme, repiquage, quantite, isReceived, affiche_Id)
       select t.ate_id, t.cont_num, t.cont_annonc, t.rpc_statut, t.sup_id, t.theme, t.repiquage, count(*), 0, null
       from tf_face_train t
       join tr_utilisateur_data u on (t.ate_id = u.ate_id)
       where t.dep_anbas = @dep_anbas
       and t.dep_sembas = @dep_sembas
       and u.loginWindows = @loginWindows
       group by t.ate_id, t.cont_num, t.cont_annonc, t.rpc_statut, t.sup_id, t.theme, t.repiquage

	    insert #res (cont_num, cont_annonc, rpc_statut, sup_nom, theme, quantite, isReceived, affiche_Id,ate_id)
	   select 
	   		prp.cont_num,
	   		prp.rpc_annonceur,
	   		prp.Statut,
	   		sup.sup_nom,
	   		prp.rpc_theme,
	   		prp.Qte_Theorique,
	   		prp.ARecevoir,
	   		prp.affiche_livraison_Id,
			prp.ate_id
	   from #res re
		inner join tf_prepa_affiche prp on re.ate_id = prp.ate_id
										and re.cont_num = prp.cont_num
										and re.cont_annonc = prp.rpc_annonceur
										and re.repiquage = prp.rpc_theme
	   join tr_categorie_support sup on sup.sup_id = prp.sup_id
	   where prp.sup_id in (100,102,105)
	   and prp.sem_annee = @dep_anbas
	   and prp.sem_num = @dep_sembas


       update #res  
       set ate_libelle = a.ate_lib + ' / '+p.plt_nom
       from #res r
       join tr_atelier a on (r.ate_id = a.ate_id)
       join tr_plateforme p on (a.plt_id = p.plt_id)

       update #res
       set statut_nom = s.statut_nom
       from #res r
       join tr_statut s on (r.rpc_statut = s.rpc_statut)

       update #res
       set sup_nom = c.sup_nom
       from #res r
       join tr_categorie_support c on (r.sup_id = c.sup_id)

       -- update dossier received to true
       update #res
       set isReceived = lr.isReceived
       from #res r
       join #livraisonReceived lr on (r.cont_num = lr.cont_num) 
	   

       -- update affiche_Id + validationAdmin when dossier is received
       update #res
       set affiche_Id = lr.affiche_id, validationAdmin = lr.validationAdmin
       from #res r
       join #livraisonReceived lr on (r.cont_num = lr.cont_num and r.sup_id = lr.sup_id) 
	   join tr_atelier at on r.ate_id = at.ate_id
        where r.cont_annonc = lr.cont_annonc and r.sup_id = lr.sup_id and r.theme = lr.theme and lr.plt_id =at.plt_id

       select * from #res order by cont_num, ate_id

       RETURN 0
end;

GO
/****** Object:  StoredProcedure [dbo].[p_s_adresse]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================================
-- Author:		PCL
-- Create date: 12/06/15
-- Description:	Recupère les données d'adresse d'un destinataire
-- =============================================================
-- Date			| User			| Description
-- -----------------------------------------------------------------------
-- 12-06-2015	| PCL.	| Création
-- 22-06-2015   | SJA   | Maj
-- -----------------------------------------------------------------------
CREATE PROCEDURE [dbo].[p_s_adresse]
    @adrId        int = NULL,
	@destId       int = NULL
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

SELECT 
        adr.adr_id as adr_id,
		adr.dest_id as dest_id,
		adr.tad_cod as tad_cod,
		adr.adr_principale as adr_principale,
		adr.adr_num_voie as num_voie,
		adr.adr_type_voie as adr_type_voie,
		adr.adr_voie as adr_voie,
		adr.adr_lieu_dit as adr_lieu_dit,
		adr.adr_code_postal as code_postal,
		adr.adr_localite as localite,
		adr.adr_cedex as adr_cedex,
		dest.dest_nom as dest_nom, 
		dest.des_type as des_type,
		dest.dest_actif as dest_actif,
		typeAdr.tad_lib as tad_lib

	FROM tr_destinataire dest
	INNER JOIN tr_dest_adresse adr ON dest.dest_id = adr.dest_id
	INNER JOIN tr_type_adresse typeAdr ON adr.tad_cod = typeAdr.tad_cod
	WHERE 
     (adr.adr_id = @adrId or @adrId is NULL) 
 AND (adr.dest_id = @destId or @destId is NULL)     
    
	-- fin de la procedure
	return 0
END
GO
/****** Object:  StoredProcedure [dbo].[p_s_affiche_a_fusionner]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[p_s_affiche_a_fusionner]
(
	@semaine	int,
	@annee      int,
	@plt_id     int
)
AS
BEGIN
	SET NOCOUNT ON;
	SET FMTONLY OFF;
	SET LANGUAGE French
-- Description : recherche tous les affiches qu'on peut fusionner
	-- 
	-- Date			| User			| Description
	-- -----------------------------------------------------------------------
	-- 15-06-2023	| YBE.			| Création

	
DECLARE @semaineDebutRecherche int = 0;
DECLARE @AnneeDebutRecherche int = 0;

CREATE TABLE #travail (affiche_id int, dateFinConservation dateTime, estConserve bit, maxSemaineDepart int, maxAnneeDepart int);
CREATE TABLE #listeAffichesParent (affiche_id_cible int, theme varchar(200), contrat varchar(200), plt_id int, sup_id int)
CREATE TABLE #listeAffichesFils (affiche_id int, theme varchar(200), semaine varchar(200), annee int, contrat varchar(200), plt_id int, sup_id int, affiche_id_cible int)
CREATE TABLE #result (affiche_id int, theme varchar(200), semaines varchar(200), contrats varchar(200), libelleFormat varchar(200), idAfficheCible int)

--calcul de l'année et semain début recherhce
IF(@semaine - 5 < 0)
BEGIN 
	SET @semaineDebutRecherche = 52 - (5 - @semaine)
	SET @AnneeDebutRecherche = @annee - 1
END
ELSE
BEGIN
	SET @semaineDebutRecherche = @semaine - 5 
	SET @AnneeDebutRecherche = @annee
END

--insertion de la table travail qui contient tous les affiches de notre périmètre de recherche
INSERT INTO #travail (affiche_id, dateFinConservation, estConserve)
SELECT 
	a.affiche_id, DATEADD(DAY, a.conservation, a.date_entree), ISNULL(a.a_conserver,0 )
FROM 
	affiche a
WHERE 
	YEAR(DATEADD(DAY, a.conservation, a.date_entree)) >= @annee - 2
	AND a.plt_id = @plt_id

--on prends pas on compte les aafiches dèjà fusionne
DELETE a FROM 
	#travail a
	JOIN fusion_affiche fusion on fusion.id_affiche = a.affiche_id

--selection date max de départ dossier pour chaque affiche
SELECT 
	t.affiche_id, MAX(dssd.Semaine) as semaineMax,MAX(dssd.Annee) as anneeMax
INTO 
	#tempMaxDepart
FROM 
	#travail t
	JOIN tf_dossier_semaine_depart dssd on dssd.IdAffiche = t.affiche_id
WHERE
	t.estConserve = 0
	AND dssd.Semaine is not null
GROUP BY 
	t.affiche_id

UPDATE t
SET
	t.maxSemaineDepart = semaineMax,
	t.maxAnneeDepart = anneeMax
FROM
	#travail t
	JOIN #tempMaxDepart temp on temp.affiche_id = t.affiche_id

--on retire les affiches saisies sans semaines départ
DELETE FROM #travail where maxSemaineDepart is null

--on filtre les affiches par date
IF(@AnneeDebutRecherche = @annee)
BEGIN
	DELETE 
	FROM #travail
	WHERE 
	estConserve = 0
	and (maxSemaineDepart not between @semaineDebutRecherche and @semaine and maxAnneeDepart = @AnneeDebutRecherche 
	or maxAnneeDepart != @AnneeDebutRecherche )
END
ELSE
BEGIN
	DELETE 
	FROM #travail
	WHERE 
	estConserve = 0
	and (maxSemaineDepart <= @semaineDebutRecherche and maxAnneeDepart = @AnneeDebutRecherche )
		 OR (maxSemaineDepart >= @semaine and maxAnneeDepart = @annee)
END

--création de la table tempo #affiches qui contient les infos des affiches
select t.affiche_id, a.theme,  a.plt_id, dssd.Dossier, dssd.Semaine, dssd.Annee, a.sup_id
into #affiches
from #travail t
JOIN affiche a on t.affiche_id = a.affiche_id  
join tf_dossier_semaine_depart dssd on dssd.IdAffiche = a.affiche_id 
WHERE a.theme is not null
	  AND a.plt_id = @plt_id
	  AND dssd.Semaine is not null
ORDER BY a.theme,  a.affiche_id

--création de la table tempo #commonInfo qui contient la liste des données communs entre plusieurs affiche
SELECT DISTINCT
	a.theme, a.plt_id, a.Semaine, a.Annee, a.Dossier, a.sup_id
INTO #commonInfo
FROM 
	#affiches a
where theme is not null
GROUP BY 
	a.theme, a.plt_id, a.Semaine, a.Annee, a.Dossier, a.sup_id
HAVING COUNT (*) > 1

-- #listeAffichesParent qui contient l'id affiche parent ==> MIN(id affiche) pour chaque group affiche q'on peut fusionner
INSERT INTO #listeAffichesParent (affiche_id_cible)
select MIN(affiche_id) as minAffiche
from #affiches a
join #commonInfo c on a.theme = c.theme and a.plt_id = c.plt_id and a.Semaine = c.Semaine and a.Annee = c.Annee	and a.Dossier = c.Dossier and a.sup_id = c.sup_id
GROUP BY  a.theme, a.plt_id, a.Semaine, a.Annee, a.Dossier, a.sup_id
HAVING count(affiche_id) > 1

UPDATE ta
SET ta.contrat = a.Dossier,
	ta.theme = a.theme,
	ta.plt_id = a.plt_id,
	ta.sup_id = a.sup_id
FROM #listeAffichesParent ta
JOIN #affiches a on ta.affiche_id_cible = a.affiche_id

-- ##listeAffichesFils qui contient l'id affiche fils
INSERT #listeAffichesFils (affiche_id , theme , semaine , contrat, plt_id , sup_id, annee)
SELECT a.affiche_id, a.theme,a.Semaine, a.Dossier, a.plt_id, a.sup_id, a.Annee
FROM #affiches a
LEFT JOIN #listeAffichesParent t on a.affiche_id = t.affiche_id_cible
WHERE t.affiche_id_cible IS NULL

SELECT *
INTO #allInfosAffichesCible
FROM #listeAffichesParent t
join tf_dossier_semaine_depart dssd on dssd.IdAffiche = t.affiche_id_cible
WHERE dssd.Semaine is not null

-- mettre l'id affiche parent pour les affiches fils
UPDATE c 
SET c.affiche_id_cible = s.affiche_id_cible
FROM #listeAffichesFils c
JOIN #allInfosAffichesCible s on s.theme = c.theme and s.plt_id = c.plt_id and s.Semaine = c.semaine and s.Annee = c.annee	and s.Dossier = c.contrat and s.sup_id = c.sup_id

DELETE FROM #listeAffichesFils
WHERE affiche_id_cible is null

-- préparation de la table résultat
INSERT INTO #result (affiche_id , theme  , idAfficheCible )
SELECT affiche_id_cible , theme  , null
FROM
     #listeAffichesParent
UNION
SELECT affiche_id , theme , affiche_id_cible
FROM
     #listeAffichesFils 

UPDATE r
SET r.semaines = a.semaines,
	r.contrats = a.cont_num,
	r.libelleFormat = sup.sup_nom
FROM #result r
JOIN affiche a on r.affiche_id = a.affiche_id
JOIN tr_categorie_support sup on sup.sup_id = a.sup_id

SELECT affiche_id , theme , semaines , contrats , libelleFormat , idAfficheCible 
FROM #result
ORDER BY theme, idAfficheCible

drop table #travail
drop table #listeAffichesParent
drop table #result
drop table #tempMaxDepart
drop table #commonInfo
drop table #affiches
drop table #listeAffichesFils
drop table #allInfosAffichesCible

	 return 0

END
GO
/****** Object:  StoredProcedure [dbo].[p_s_annonceur]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================
-- Author:		Mathieu Lebigre
-- Create date: 05/06/2008
-- Description:	Renvoi la liste des annonceurs contenus dans tf_repart_calcul
--	Possibilité de filtrer sur les critères :
--		- semaine et année de début
--		- semaine et année de fin
--		- rpc_statut
-- =============================================
-- Date			| User			| Description
-- -----------------------------------------------------------------------
-- 12-10-2011	| Wheeler A.	| ajout de l'utilisateur pour prendre 
--				|				| en compte la repartition wissous / nimes
-- -----------------------------------------------------------------------
CREATE PROCEDURE [dbo].[p_s_annonceur]
	@user			varchar(50),
	@sem_num_deb	tinyint,
	@sem_annee_deb	smallint,
	@sem_num_fin	tinyint,
	@sem_annee_fin	smallint,
	@rpc_statut		tinyint
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
	declare @ate_id smallint
	
	select @ate_id = ate_id
	from tr_utilisateur
	where loginWindows = @user
	
	--Ajout d'un annonceur "Tous" en début de résultat
	SELECT	'Tous' rpc_annonceur
	UNION ALL
	SELECT	r.rpc_annonceur 
	FROM	tf_repart_calcul r
	WHERE	r.rpc_statut=isnull(@rpc_statut,r.rpc_statut) 
	AND r.sem_num>=isnull(@sem_num_deb,r.sem_num)
	AND r.sem_annee>=isnull(@sem_annee_deb,r.sem_annee)
	AND r.sem_num<=isnull(@sem_num_fin,r.sem_num)
	AND r.sem_annee<=isnull(@sem_annee_fin,r.sem_annee)
	and r.ate_id = @ate_id		
	GROUP BY r.rpc_annonceur 
	
	-- fin de la procedure
	return 0
END
GO
/****** Object:  StoredProcedure [dbo].[p_s_atelier]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE procedure [dbo].[p_s_atelier]
(
	@loginWindows	varchar(50)
)
as
begin

select @loginWindows = upper (@loginWindows)
	-- description : retourne l'atelier de l'utilisateur
	----------------------------------------------------------------------------
	-- 2015.06.08	| CLEMENT. P	| Optim + retour plt et ateId unitairement
	-- 2015.04.07	| CLEMENT. P	| Creation
	----------------------------------------------------------------------------
	
    SELECT tra.ate_id,
       trp.plt_nom,
	   tra.ate_lib,
       tra.ate_lib + ' / ' + trp.plt_nom as 'ate_libelle'
	FROM tr_utilisateur_data trud
	INNER JOIN tr_atelier tra ON trud.ate_id = tra.ate_id
	INNER JOIN tr_plateforme trp ON tra.plt_id= trp.plt_id
	WHERE trud.loginWindows = @loginWindows
	
    if @@error <> 0
		return -1
	
	-- fin de la procedure
	return 0
end
GO
/****** Object:  StoredProcedure [dbo].[p_s_atelierprepa]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
create procedure [dbo].[p_s_atelierprepa]
(
	@ate_id	smallint
)
as
begin
	-- description : retourne l'atelier de l'utilisateur
	--
	-- 2014.12.03	| Jaoen.	| Creation


if @ate_id = 5 or @ate_id =6 or @ate_id = 7 
    select tpr_id, tpr_lib
    from tr_type_preparation
    where tpr_id
    in (2,10)
else 
    select tpr_id, tpr_lib
    from tr_type_preparation
    where tpr_id
    in (2,10, 12)


    if @@error <> 0
		return -1
	
	-- fin de la procedure
	return 0
end
GO
/****** Object:  StoredProcedure [dbo].[p_s_atelierScro]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE procedure [dbo].[p_s_atelierScro]
(
	@loginWindows	varchar(50)
)
as
begin

select @loginWindows = upper (@loginWindows)
	-- description : retourne l'atelier de l'utilisateur
	--
	-- 2013.10.28	| Wheeler A.	| Creation
	-- 2015.07.31	| CLEMENT P.	| Modif E/S

SELECT tra.ate_id as ate_id,
       trp.plt_nom as plt_nom,
	   tra.ate_lib as ate_lib,
       tra.ate_lib + ' / ' + trp.plt_nom as 'ate_libelle'
	FROM tr_utilisateur_data trud
	INNER JOIN tr_atelier tra ON trud.ate_id = tra.ate_id
	INNER JOIN tr_plateforme trp ON tra.plt_id= trp.plt_id
	WHERE trud.loginWindows = @loginWindows 
	  and tra.ate_id in (5,6,7,8,11,12)
	ORDER BY  ate_lib

    if @@error <> 0
		return -1
	
	-- fin de la procedure
	--return 0
end

GO
/****** Object:  StoredProcedure [dbo].[p_s_batch]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


CREATE PROCEDURE [dbo].[p_s_batch]	( 
	@batch  sysname,
	@step	tinyint		out,
	@statut	char(2)		out)
AS
/*-------------------------------------------------------------------------------*/
--  Procédure            : p_s_batch
--  Auteur               : AMS						  
--  Date de création     : 27/06/07                                     
--  Description 	 : selection de l'étape et du statut en cours de la dernière exécution d'un batch     	  
--  Auteur - Date - Nature modif. : 					  
--  	AMS - 27/06/07 - ...      	                        
--  Paramètres d'entrée  :      @batch - nom du batch (ps) à executer
--  Paramètres de sortie :      @step	- étape du batch à la derniere exécution,
--				@statut	- statut de l'étape du batch à la derniere exécution                                          
--  Retour 		 : 	(=0 : OK) ; (!=0 - erreur fonctionnelle ou serveur)		
/*-------------------------------------------------------------------------------*/
BEGIN

declare @rowcount	int

	select  @step = bat_step,
		@statut = bat_statut
	from	tt_batch
	where 	bat_batch = @batch
	
	
	select @rowcount = @@rowcount
	if @rowcount != 1 
	begin
		return 1
	end
	
return
END

GO
/****** Object:  StoredProcedure [dbo].[p_s_colis]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/* =============================================================================
   2) p_s_colis
   ============================================================================= */
CREATE PROCEDURE [dbo].[p_s_colis]
	@user			varchar(50),
	@codeColis		varchar(20) = NULL,
	@contNum		int = NULL,
	@dateRechDebut	dateTime = NULL,
	@dateRechFin	dateTime = NULL,
	@ateId			smallint = NULL
AS
BEGIN
	-- Description: Affiche la liste des colis
	-- 
	-- Date			| User			| Description
	-- -----------------------------------------------------------------------
	-- 21-04-2015	| PCL.			| Création
	-- 18-09-2015	| PCL.			| Prise en compte de ateId
	-- 30-10-2015	| SJA.			| Prise en compte des trains 
	-- 2016.06.28	| Wheeler A.	| correction sur les quantites des trains et nettoyage
	-- 2017.07.04	| Wheeler A.	| correction sur la date de fin de recherche pour que la date du jour soit incluse
	-- 2019.06.18   | YBE           | ajout des nouveaux champs de l'api GEODIS
	-- obligatoire : User
	select @user = upper (@user) 
    
	if (@codeColis = '' ) set @codeColis = NULL
	if (@contNum = 0 ) set @contNum = NULL
	
	-- colis avec des ums
	select c.colis_id,
		c.fc_col_id,
		f.fc_col_desc,
		c.colis_code,
		c.rpc_statut,
		s.statut_nom,
		c.dest_id,
		c.ate_id,
		c.colis_dat_expe,
		sum(isnull(uc.uc_qte, 0)) as qte,
		t.tsp_id,
		t.tsp_nom,
		c.colis_code_ext,
		c.adr_destinataire,
		c.date_livraison,
		c.date_etat,
		c.libelle_etat,
		c.url_image_livraison,
		c.url_preuve_livraison,
		c.ref_uni_exp
	from tf_colis c
	JOIN tr_format_colis f on (c.fc_col_id = f.fc_col_id)
	JOIN tr_statut s on (c.rpc_statut = s.rpc_statut )
	LEFT JOIN tr_transporteur t on (c.tsp_id = t.tsp_id)
	LEFT JOIN tf_UM_colis uc on (c.colis_id = uc.colis_id)
	LEFT JOIN tf_UM u on (uc.UM_id = u.UM_id)
	WHERE (	(	(c.colis_dat_expe > @dateRechDebut or @dateRechDebut is null) AND 
				(convert(date, c.colis_dat_expe) <= @dateRechFin or @dateRechFin is null)
			) or
			c.colis_dat_expe is null
		)
	AND (u.cont_num = @contNum or @contNum is null)
	AND (c.colis_code = @codeColis or @codeColis is null)
	AND (c.ate_id = @ateId or @ateId is null)
	AND c.ate_id in (select ate_id from tr_atelier where ate_type = 1) -- ateliers fixe/pliage 
	group by c.colis_id,
		c.fc_col_id,
		f.fc_col_desc,
		c.colis_code,
		c.rpc_statut,
		s.statut_nom,
		c.dest_id,
		c.ate_id,
		c.colis_dat_expe,
		t.tsp_id,
		t.tsp_nom,
		c.colis_code_ext,
		c.adr_destinataire,
		c.date_livraison,
		c.date_etat,
		c.libelle_etat,
		c.url_image_livraison,
		c.url_preuve_livraison,
		c.ref_uni_exp
	union
	-- colis avec des trains
	select c.colis_id,
		c.fc_col_id,
		f.fc_col_desc,
		c.colis_code,
		c.rpc_statut,
		s.statut_nom,
		c.dest_id,
		c.ate_id,
		c.colis_dat_expe,
		count(distinct ft.train_id) as qte,
		t.tsp_id,
		t.tsp_nom,
		c.colis_code_ext,
		c.adr_destinataire,
		c.date_livraison,
		c.date_etat,
		c.libelle_etat,
		c.url_image_livraison,
		c.url_preuve_livraison,
		c.ref_uni_exp
	from tf_colis c
	JOIN tr_format_colis f on (c.fc_col_id = f.fc_col_id)
	JOIN tr_statut s on (c.rpc_statut = s.rpc_statut )
	LEFT JOIN tr_transporteur t on (c.tsp_id = t.tsp_id)
	LEFT JOIN tf_face_train ft on (c.colis_id = ft.colis_id)
	WHERE (	(	(c.colis_dat_expe > @dateRechDebut or @dateRechDebut is null) AND 
				(convert(date, c.colis_dat_expe) <= @dateRechFin or @dateRechFin is null)
			) or
			c.colis_dat_expe is null
		)
	AND (ft.cont_num = @contNum or @contNum is null)
	AND (c.colis_code = @codeColis or @codeColis is null)
	AND (c.ate_id = @ateId or @ateId is null)
	AND c.ate_id in (select ate_id from tr_atelier where ate_type = 2) -- ateliers deroulant/scrolling
	group by c.colis_id,
		c.fc_col_id,
		f.fc_col_desc,
		c.colis_code,
		c.rpc_statut,
		s.statut_nom,
		c.dest_id,
		c.ate_id,
		c.colis_dat_expe,
		t.tsp_id,
		t.tsp_nom,
		c.colis_code_ext,
		c.adr_destinataire,
		c.date_livraison,
		c.date_etat,
		c.libelle_etat,
		c.url_image_livraison,
		c.url_preuve_livraison,
		c.ref_uni_exp
END
GO
/****** Object:  StoredProcedure [dbo].[p_s_colis_from_dest]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
/* =============================================================================
   1) p_s_colis_from_dest
   ============================================================================= */
CREATE PROCEDURE [dbo].[p_s_colis_from_dest]
(
	@dest_id	int,
	@ate_id		smallint
)
AS
BEGIN
	-- Description :	recherche les colis "en cours" à partir destinaire
	-- 
	-- Date			| User			| Description
	-- -----------------------------------------------------------------------
	-- 09-02-2015	| SJA.			| Création
	-- 30-10-2015   | SJA.			| Prise en compte des trains
	-- 2016.06.21	| Wheeler A.	| suppression des colonnes inutiles
	-- 2016.07.20	| Wheeler A.	| ajout de la colonne pour le nombre d'UM
	-- 2016.08.02	| Wheeler A.	| correction sur le calcul du nombre d'UM (cas ou il n'y a pas d'um)
	-- -----------------------------------------------------------------------
	   
	select c.colis_id,
		c.colis_code,
		c.fc_col_id,
		f.fc_col_desc as format_colis,
		c.rpc_statut,
		s.statut_nom,
		c.dest_id,
		c.ate_id,
		c.colis_user,
		c.colis_dat_cre,
		c.colis_dat_maj,
		sum(isnull(u.uc_qte, 0)) as qte,
		count(u.colis_id) as qteUM
	from tf_colis c
	join tr_format_colis f on (c.fc_col_id = f.fc_col_id)
	join tr_statut s on (c.rpc_statut = s.rpc_statut )
	left join tf_UM_colis u on (c.colis_id = u.colis_id )
	where c.rpc_statut = 1
	and c.ate_id = @ate_id
	and c.dest_id = @dest_id
	and c.ate_id in (select ate_id from tr_atelier where ate_type = 1) -- ateliers fixe/pliage
	group by c.colis_id,
		c.colis_code,
		c.fc_col_id,
		f.fc_col_desc,
		c.rpc_statut,
		s.statut_nom,
		c.dest_id,
		c.ate_id,
		c.colis_user,
		c.colis_dat_cre,
		c.colis_dat_maj
		   
	union
	select c.colis_id,
		c.colis_code,
		c.fc_col_id,
		f.fc_col_desc as format_colis,
		c.rpc_statut,
		s.statut_nom,
		c.dest_id,
		c.ate_id,
		c.colis_user,
		c.colis_dat_cre,
		c.colis_dat_maj,
		count(distinct t.train_id) as qte,
		convert(int, 0) as qteUM
	from tf_colis c
	join tr_format_colis f on (c.fc_col_id = f.fc_col_id)
	join tr_statut s on (c.rpc_statut = s.rpc_statut )
	left join tf_face_train t on (c.colis_id = t.colis_id )
	where c.rpc_statut = 1
	and c.ate_id = @ate_id
	and c.dest_id= @dest_id
	and c.ate_id in (select ate_id from tr_atelier where ate_type = 2) -- ateliers deroulant/scrolling
	group by c.colis_id,
		c.colis_code,
		c.fc_col_id,
		f.fc_col_desc,
		c.rpc_statut,
		s.statut_nom,
		c.dest_id,
		c.ate_id,
		c.colis_user,
		c.colis_dat_cre,
		c.colis_dat_maj

	-- fin de la procedure
	return 0
END
GO
/****** Object:  StoredProcedure [dbo].[p_s_colis_from_UM]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- =========================================================================
-- Author:		PCL
-- Create date: 23/03/2015
-- Description:	recherche les colis rattachés à une UM fournie en paramètre
-- =========================================================================
-- Date			| User			| Description
-- -----------------------------------------------------------------------
-- 23-03-2015	| PCL.	| Création
-- -----------------------------------------------------------------------

CREATE PROCEDURE [dbo].[p_s_colis_from_UM] 
	@UMid			int  
       
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	SET FMTONLY OFF;   

	select distinct
	tf_UM.UM_code_barre as UM_code_barre,
	tf_colis.colis_id as colis_id,
	tf_colis.colis_code as colis_code,
	tr_format_colis.fc_col_id as fc_col_id,
	tr_format_colis.fc_col_desc as fc_col_desc,
	tf_colis.rpc_statut as rpc_statut,
	tr_statut.statut_nom as statut_nom,
	sum (isnull(uc_qte,0)) as qte
	from tf_UM
	inner join tf_UM_colis on tf_UM.UM_id = tf_UM_colis.UM_id
	inner join tf_colis on tf_UM_colis.colis_id = tf_colis.colis_id
	inner join tr_format_colis on tf_colis.fc_col_id = tr_format_colis.fc_col_id
	inner join tr_statut on tf_colis.rpc_statut = tr_statut.rpc_statut
	where tf_UM.UM_id = @UMid
	group by 
	tf_UM.UM_code_barre,
	tf_colis.colis_id,
	tf_colis.colis_code,
	tr_format_colis.fc_col_id,
	tr_format_colis.fc_col_desc,
	tf_colis.rpc_statut,
	tr_statut.statut_nom
	return 0
END
GO
/****** Object:  StoredProcedure [dbo].[p_s_colis_transporteur_externe]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[p_s_colis_transporteur_externe] 
	@colisId        int,
	@user			varchar(50) = NULL

AS
BEGIN
	-- =====================================================================================
	-- Author:		PCL
	-- Create date: 23/09/15
	-- Description:	Permet de ramener les données necéssaires à la constitution du fichier
	--              à destination du transporteur externe (CALBERSON à ce jour)
	-- =====================================================================================
	-- Date			| User			| Description
	-- -----------------------------------------------------------------------
	-- 23-09-2015	| PCL.			| Création
	-- -----------------------------------------------------------------------
	-- 2016.02.15	| Wheeler A.	| correction mapping colonne pour calberson plus ajout colonne
	--------------------------------------------------------------------------
	-- 2016.03.04	| Wheeler A.	| modification recuperation du poste claberson (gestion du par defaut)
	--------------------------------------------------------------------------

	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	-- obligatoire : User
    select @user = upper (@user) 

	SELECT col.colis_id          as colis_id,
	col.colis_code               as colis_code,
	col.colis_code_ext           as transporteur_code_ext,
	col.colis_dat_expe           as colis_dat_expe,
	col.dest_id                  as dest_id,

	col.adr_id                   as adr_id,
	case when d.des_type = 1 then 'CITYZ MEDIA '+col.adr_destinataire else col.adr_destinataire end as adr_destinataire,
	col.adr_num_voie             as adr_num_voie,
	col.adr_type_voie            as adr_type_voie,
	col.adr_voie                 as adr_voie,
	col.adr_lieu_dit             as adr_lieu_dit,
	case when a.calb_id is null then col.adr_localite else c.calb_commune end as adr_localite,
	case when a.calb_id is null then col.adr_code_postal else c.calb_postal end as adr_code_postal,
	col.adr_cedex                as adr_cedex,

	ate.ate_id                   as ate_id,
	ate.ate_lib                  as ate_lib,  
	
	tta.tarif_code               as tarif_code,
	tta.tarif_expediteur         as tarif_expediteur,
	tta.tarif_code_fac_client    as tarif_code_fac_client,
	tta.tarif_incoterm           as tarif_incoterm,
	tta.tarif_type_edition       as tarif_type_edition,
	tta.tarif_regroupement       as tarif_regroupement,

	ta.tra_ip                    as tra_ip,
	ta.tra_code_tiers            as tra_code_tiers,

	trsp.tsp_id                  as tsp_id,
	trsp.tsp_nom                 as transporteur_nom,

	-- poste
	isnull(p1.poste_calber, p2.poste_calber) as poste_calber,
	isnull(col.colis_poids, 0) as colis_poids

	from tf_colis col
	JOIN tr_trans_tarif tta on (col.tsp_id = tta.tsp_id and col.tarif_code = tta.tarif_code)
	JOIN tr_transporteur_atelier ta on (col.ate_id = ta.ate_id and col.tsp_id = ta.tsp_id)
	JOIN tr_atelier ate on (col.ate_id = ate.ate_id)  
	join tr_dest_adresse a on (col.adr_id = a.adr_id)
	left join tr_poste p1 on (col.ate_id = p1.ate_id
								and p1.poste_ip = @user)
	left join tr_poste p2 on (col.ate_id = p2.ate_id)
	join tr_destinataire d on (col.dest_id = d.dest_id)
	left join tr_communes_calber c on (a.calb_id = c.calb_id)
	LEFT JOIN tr_transporteur trsp on (col.tsp_id = trsp.tsp_id)
	WHERE col.colis_id = @colisId
   
	-- fin de la procedure
	return 0
END
GO
/****** Object:  StoredProcedure [dbo].[p_s_controle_rendumain]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE procedure [dbo].[p_s_controle_rendumain]
(
	@rpfo_ident	int
)
as
begin

-- renvoie la liste des préparation empêchant le déblocage
select plt_nom as plt_nom, 
ate_lib as ate_lib, 
tf_UM.UM_code_barre as UM_code_barre, 
tf_UM.cont_num as cont_num, 
tf_UM.UM_theme as UM_theme, 
statut_nom as  statut_nom
from tf_UM, tf_repart_calcul, tr_atelier, tr_plateforme, tr_statut
where tf_UM.UM_id =  tf_repart_calcul.UM_id
and tf_UM.ate_id = tr_atelier.ate_id
and tr_atelier.plt_id = tr_plateforme.plt_id
and tf_UM.rpc_statut = tr_statut.rpc_statut
and tf_UM.rpc_statut >= 6
and tf_repart_calcul.rpc_rpfo_ident = @rpfo_ident

return 0
	
    if @@error <> 0
		return -1
	
	-- fin de la procedure
	return 0
end
GO
/****** Object:  StoredProcedure [dbo].[p_s_dest_from_code]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[p_s_dest_from_code]
(
	@code	varchar(20)
)
AS
BEGIN
	-- Description : recherche le destintataire à partir d'un code barre
	-- 
	-- Date			| User			| Description
	-- -----------------------------------------------------------------------
	-- 09-02-2015	| SJA.			| Création
	-- 30-10-2015	| SJA.			| Prise en compte des trains
	-- 2016.02.15	| Wheeler A.	| correction pour ajouter un else
	-- 2016.06.21	| Wheeler A.	| ajout de la gestion des trains
	     
	-- test si le code barre est un code barre d'UM
	IF (select COUNT(1) from tf_UM where UM_code_barre = @code) > 0
	BEGIN    
		select d.dest_id,
			d.dest_nom,
			a.ate_id,
			a.ate_lib,
			p.plt_id, 
			p.plt_nom
		from tf_UM u
		join tr_destinataire d on (u.dest_id = d.dest_id)
		join tr_atelier a on (u.ate_id = a.ate_id)
		join tr_plateforme p on (a.plt_id = p.plt_id)
		where u.UM_code_barre = @code
		
		return 0
	END

	-- test si le code barre est un code barre de synthese d'UMs
	IF (select COUNT(1) from tf_UM where UM_code_synthese = @code) > 0
	BEGIN
		select distinct d.dest_id,
			d.dest_nom,
			a.ate_id,
			a.ate_lib,
			p.plt_id,
			p.plt_nom
		from tf_UM u
		join tr_destinataire d on (u.dest_id = d.dest_id)
		join tr_atelier a on (u.ate_id = a.ate_id)
		join tr_plateforme p on (a.plt_id = p.plt_id)
		where u.UM_code_synthese = @code

		return 0
	END

	-- test si le code barre est un code barre de train
	if exists (select 1 from tf_face_train where train_id = @code)
	begin
		select distinct d.dest_id,
			d.dest_nom,
			a.ate_id,
			a.ate_lib,
			p.plt_id,
			p.plt_nom
		from tf_face_train t
		join tr_destinataire d on (t.dest_id = d.dest_id)
		join tr_atelier a on (t.ate_id = a.ate_id)
		join tr_plateforme p on (a.plt_id = p.plt_id)
		where t.train_id = @code

		return 0
	end

	-- cas par defaut test code barre colis
	select d.dest_id,
		d.dest_nom,
		a.ate_id,
		a.ate_lib,
		p.plt_id,
		p.plt_nom
	from tf_colis c
	join tr_destinataire d on (c.dest_id = d.dest_id)
	join tr_atelier a on (c.ate_id = a.ate_id)
	join tr_plateforme p on (a.plt_id = p.plt_id)
	where c.colis_code = @code

    -- fin de la procedure
	return 0
END
GO
/****** Object:  StoredProcedure [dbo].[p_s_dest_from_code_trains]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[p_s_dest_from_code_trains]
(
	@code              varchar(20)
)
AS
BEGIN
	-- Description: recherche le destintataire à partir d'un code barre de train
	-- 
	-- ---------------------------------
	-- Date       | User  | Description
	-- -----------------------------------------------------------------------
	-- 07-12-2015	| PCL.			| Création
	-- 2016.06.20	| Wheeler A.	| ajout de la plateforme dans le retour
	--				|				| ajout du cas ou on scanne un code colis 

	-- on recherche par train_id
	select distinct d.dest_id,
		d.dest_nom,
		a.ate_id,
		a.ate_lib,
		p.plt_id,
		p.plt_nom
	from tf_face_train t
	join tr_destinataire d on (t.dest_id = d.dest_id)
	join tr_atelier a on (t.ate_id = a.ate_id)
	join tr_plateforme p on (a.plt_id = p.plt_id)
	where t.train_id = @code

	if (@@ROWCOUNT = 0)
	begin
		select distinct d.dest_id,
			d.dest_nom,
			a.ate_id,
			a.ate_lib,
			p.plt_id,
			p.plt_nom
		from tf_colis c
		join tr_destinataire d on (c.dest_id = d.dest_id)
		join tr_atelier a on (c.ate_id = a.ate_id)
		join tr_plateforme p on (a.plt_id = p.plt_id)
		where c.colis_code = @code
	end

    -- fin de la procedure
	return 0
END
GO
/****** Object:  StoredProcedure [dbo].[p_s_destinataire]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================================
-- Author:		PCL
-- Create date: 25/03/15
-- Description:	Recupère les données de destinataire d'un colis
-- =============================================================
-- Date			| User			| Description
-- -----------------------------------------------------------------------
-- 25-03-2015	| PCL.	   | Création
-- 22-06-2015	| SAJ/PCL. | Maj
-- -----------------------------------------------------------------------
CREATE PROCEDURE [dbo].[p_s_destinataire] 
    
AS

BEGIN
    
    -- ajouter le critère actif /oui:non
    
    
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;


SELECT 
        dest.des_id as des_id ,
        dest.dest_nom_ori as dest_nom, 
        dest.dest_actif as dest_actif,
		dest.dest_dispatch as dest_dispatch,
		typedes.type_nom as des_type,
		adr.adr_id as adr_id,
		adr.adr_code_postal as code_postal,
		adr.adr_localite as localite,
        dest.dest_id as dest_id
	FROM tr_destinataire dest
	INNER JOIN tr_dest_adresse adr ON dest.dest_id = adr.dest_id
    INNER JOIN tr_type_destination  typedes ON  dest.des_type = typedes.des_type
	
	-- fin de la procedure
	return 0
END
;
GO
/****** Object:  StoredProcedure [dbo].[p_s_destinataire_detail]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================================
-- Author:		PCL
-- Create date: 25/03/15
-- Description:	Recupère les données de destinataire d'un colis
-- =============================================================
-- Date			| User			| Description
-- -----------------------------------------------------------------------
-- 25-03-2015	| PCL.	| Création
-- -----------------------------------------------------------------------
CREATE PROCEDURE [dbo].[p_s_destinataire_detail] 
    (
	@dest_id		int
	)
as

BEGIN
    
    -- ajouter le critère actif /oui:non
    
    
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;


SELECT 
        dest.des_id as des_id ,
        dest.dest_nom_ori as dest_nom_ori, 
        dest.dest_nom as dest_nom, 
        dest.dest_actif as dest_actif,
		dest.dest_dispatch as dest_dispatch,
		typedes.type_nom as des_type,
		        dest.dest_id as dest_id
	FROM tr_destinataire dest
	INNER JOIN tr_type_destination  typedes ON  dest.des_type = typedes.des_type
    where dest.dest_id = @dest_id
	
	-- fin de la procedure
	return 0
END
;
GO
/****** Object:  StoredProcedure [dbo].[p_s_destination_Colis]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================================
-- Author:		PCL
-- Create date: 25/03/15
-- Description:	Recupère les données de destination d'un colis
-- =============================================================
-- Date			| User			| Description
-- -----------------------------------------------------------------------
-- 25-03-2015	| PCL.	| Création
-- 02/06/2016	| SJA.	| Supression tr_destination
-- -----------------------------------------------------------------------
CREATE PROCEDURE [dbo].[p_s_destination_Colis] 
	@colisId		int	
    
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

SELECT 
        tf_colis.colis_id as colis_id,
		tf_colis.colis_code as colis_code,
		CAST(tr_destinataire.dest_id AS int) as des_id,
		tr_destinataire.dest_nom as dest_nom, 
		convert (varchar( 50),isnull (tr_dest_adresse.adr_num_voie,'') + 
        isnull (tr_dest_adresse.adr_type_voie,'') +
        isnull (tr_dest_adresse.adr_voie,'') ) as adr_1,
        convert (varchar (50), isnull (tr_dest_adresse.adr_lieu_dit,'')) as adr_2,
        convert (varchar (50), null) as adr_3,
        tr_dest_adresse.adr_code_postal as postal,
        tr_dest_adresse.adr_localite as localite,
        convert ( varchar(15), null) as tel,
        convert ( varchar(15), null) as fax
	FROM tf_colis
    INNER JOIN tr_destinataire ON (tf_colis.dest_id = tr_destinataire.dest_id)    
	INNER JOIN tr_dest_adresse ON (tr_destinataire.dest_id = tr_dest_adresse.dest_id)
      
    WHERE
    tf_colis.colis_id = @colisId 
    and tr_dest_adresse.adr_principale = '1'
     
    
	-- fin de la procedure
	return 0
END
;
GO
/****** Object:  StoredProcedure [dbo].[p_s_destruction]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[p_s_destruction]
 @plt_id smallint null,
 @historique bit,
 @date_debut datetime,
 @date_fin datetime
AS 
BEGIN 
	SET NOCOUNT ON;
	SET FMTONLY OFF;

select distinct
	aff.affiche_id as NumeroAffiche,
	sup.sup_nom as Format,
	aff.date_rebus as DateDeDestruction,
	aff.cont_annonc as Annonceur,
	aff.theme as Theme,
	aff.repiquage as Repiquage,
	aff.quantite as Quantite,
	prep.ARecevoir as ARecevoir,
	aff.date_entree as DateEntree,
	aff.rebus as Rebus,
	aff.a_conserver as AConserver
into #result
from affiche aff
	inner join tr_categorie_support sup on aff.sup_id = sup.sup_id
	left join tf_prepa_affiche prep on aff.affiche_id = prep.affiche_livraison_Id
where 
	(date_dernier_depart < DATEADD(week, -4, getdate()) and a_conserver = 1 and date_entree < DATEADD(day, -365, getdate()))
	or( date_dernier_depart < DATEADD(week, -4, getdate()) and (a_conserver = 0 or a_conserver is null))
	and aff.plt_id = @plt_id
	and aff.rebus != 0

IF @historique = 1
	BEGIN
		select * 
		from #result
		where  DateEntree between @date_debut and @date_fin
	END
ELSE
	BEGIN
		select * from #result
	END
drop table #result
END
GO
/****** Object:  StoredProcedure [dbo].[p_s_detail_colis]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[p_s_detail_colis] 
	@colis_id	int

AS
BEGIN
	-- =============================================
	-- Author:		PCL
	-- Create date: 21/04/15
	-- Description:	Affiche les détail d'un colis
	-- =============================================
	-- Date			| User			| Description
	-- -----------------------------------------------------------------------
	-- 22-06-2015	| PCL.			| Création
	-- -----------------------------------------------------------------------
	-- 2016-01-21	| Wheeler A.	| mise a jour pour remplacer la procedure p_s_transporteur_from_colis
	-- -----------------------------------------------------------------------

	-- declaration
	declare @qte int

	-- on calcule la quantite du colis
	select @qte = sum(uc_qte)
	from tf_UM_colis
	where colis_id = @colis_id

	-- on retourne les informations du colis
	select c.colis_id,
		c.dest_id,
		d.dest_nom,
		c.colis_code,
		@qte as quantite,
		c.rpc_statut,
		s.statut_nom,
		c.colis_dat_expe,
		c.tsp_id,
		c.tarif_code,
		t.tsp_nom,
		c.colis_code_ext,
		c.adr_id,
		c.adr_destinataire,
		c.adr_num_voie,
		c.adr_type_voie,
		c.adr_voie,
		c.adr_lieu_dit,
		c.adr_localite,
		c.adr_code_postal,
		c.adr_cedex
	from tf_colis c
	join tr_destinataire d on (c.dest_id = d.dest_id)
	join tr_statut s on (c.rpc_statut = s.rpc_statut)
	left join tr_transporteur t on (c.tsp_id = t.tsp_id)
	where c.colis_id = @colis_id
   
	-- fin de la procedure
	return 0
END
GO
/****** Object:  StoredProcedure [dbo].[p_s_face_train]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[p_s_face_train] 
	@user			varchar(50),
	@numsemaine		varchar(2),
	@numannee		varchar(4),
    @ate_id         smallint,
	@EstTriSurConvention bit
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
	SET FMTONLY OFF;
    
    select @user = upper (@user)

    -- obligatoire : User/numsemaine/numannée
   
	if (@numsemaine = '' or @numsemaine = 0)  set @numsemaine = NULL
	if (@numannee = '' or @numannee = 0)  set @numannee = NULL
    
select 
ft.train_id,	
ft.cadr_ident,	
ft.cadre_lib,
ft.sup_id as sup_id,	
sup_nom , 
commune,
theme,
repiquage,
empl_addresse1,
idre_nom,
ft.rpc_statut as rpc_statut,
statut_nom,
isnull (cont_num, rese_ident) 'Contrat',
dest_nom_ori,
ft.ft_id,
cont_annonc as cont_annonc,
ft.CoteCote,
ft.RefConvention
into #res
FROM tf_face_train ft
    JOIN tr_categorie_support ON (ft.sup_id = tr_categorie_support.sup_id)
    JOIN tr_statut ON (ft.rpc_statut = tr_statut.rpc_statut)
    JOIN tr_destinataire ON (ft.dest_id= tr_destinataire.dest_id)
    JOIN tr_utilisateur_data ON (ft.ate_id = tr_utilisateur_data.ate_id)
    JOIN tr_atelier ON (ft.ate_id = tr_atelier.ate_id)
	--LEFT JOIN tf_colis col ON (ft.colis_id = col.colis_id)
	--LEFT JOIN tr_transporteur trsp ON (col.tsp_id = trsp.tsp_id)
where
ft.dep_anbas	= @numannee
and ft.dep_sembas	= @numsemaine
and tr_utilisateur_data.loginWindows = @user
and ft.ate_id = @ate_id

if	@EstTriSurConvention = 1
	select *
		from #res res 
	inner join tr_train_convention_a_trier tri on res.RefConvention = tri.Reference
else
		select * from #res res 
			left join tr_train_convention_a_trier tri on res.RefConvention = tri.Reference
		where tri.Reference is null
	--inner join tr_train_convention_a_trier tri on res.RefConvention is null or res.RefConvention  != tri.Reference

	-- fin de la procedure
	return 0
END
;
  
GO
/****** Object:  StoredProcedure [dbo].[p_s_face_train_export_caire]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


CREATE PROCEDURE [dbo].[p_s_face_train_export_caire] 
	@user			varchar(50),
	@numsemaine		varchar(2),
	@numannee		varchar(4),
    @ate_id         smallint,
	@pre_assemblage bit
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
	SET FMTONLY OFF;
    
    select @user = upper (@user)

    -- obligatoire : User/numsemaine/numann�e
   
	if (@numsemaine = '' or @numsemaine = 0)  set @numsemaine = NULL
	if (@numannee = '' or @numannee = 0)  set @numannee = NULL

select train_id, SUM(CASE WHEN ISNULL(pre_assemblage,0) = 0 THEN 0 ELSE 1 END) NombreFaceEnPreAssemblage, COUNT(train_id) NombreTrain
into #temp
from tf_face_train t
where t.dep_anbas = @numannee
	  and t.dep_sembas = @numsemaine
	  and t.ate_id = @ate_id
group by t.train_id
    
select distinct
ft.agreement,
ft.ate_id,	
ft.cadr_ident,	
ft.cadre_lib,
ft.commune,
ft.cont_annonc,
isnull (cont_num, rese_ident) 'contrat',
ft.dest_id, 
ft.empl_addresse1,
ft.idre_nom,
ft.instr_code,
ft.ordre_reel,
ft.pers_nom,
ft.reac_code,
ft.rdep_datdep,
ft.repiquage,
ft.rpc_statut,
dest.dest_nom_ori,	
ft.sup_id,
tr_categorie_support.sup_nom,
ft.theme,
ft.train_id,
ft.typr_code,
st.statut_nom,
ft.ft_id,
rl.rouleur_nom,
CASE ft.ate_id
      WHEN 5 THEN '2m2 Déroulant'
      WHEN 6 THEN '2m2 Déroulant'
	  WHEN 7 THEN '2m2 Déroulant'
      WHEN 8 THEN '2m2 Déroulant'
	  ELSE 'Inconnu'
   END as FormatPrep,
ft.cadr_lettre,
ft.empl_depa_code,
ft.CodeUniteUrbaine,
ft.comm_numord,
ft.empl_numord

FROM tf_face_train as ft
    JOIN tr_categorie_support ON (ft.sup_id = tr_categorie_support.sup_id)
    JOIN tr_statut as st ON (ft.rpc_statut = st.rpc_statut)
    JOIN tr_destinataire as dest ON (ft.dest_id= dest.dest_id)
    JOIN tr_utilisateur_data ON (ft.ate_id = tr_utilisateur_data.ate_id)
    JOIN tr_atelier ON (ft.ate_id = tr_atelier.ate_id)
	LEFT JOIN tr_rouleur as rl on rl.rouleur_id = ft.rouleur_id
	left join #temp tp on tp.train_id = ft.train_id


where
ft.dep_anbas	= @numannee
and ft.dep_sembas	= @numsemaine
and tr_utilisateur_data.loginWindows = @user
and ft.ate_id = @ate_id
and ft.rpc_statut = 9 -- Uniquement les trains en statut ExportPrepa
and (( @pre_assemblage = 1 AND isnull(ft.pre_assemblage,0) = isnull(@pre_assemblage,0) AND tp.NombreFaceEnPreAssemblage = tp.NombreTrain)
	  OR (isnull(@pre_assemblage,0) = 0)
	)


	-- fin de la procedure
	return 0
END
;

GO
/****** Object:  StoredProcedure [dbo].[p_s_gatewayExtractionPoster]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================
-- Author:		<Author,,Name>
-- Create date: <Create Date,,>
-- Description:	<Description,,>
-- =============================================
Create PROCEDURE [dbo].[p_s_gatewayExtractionPoster]
	-- Add the parameters for the stored procedure here
	@TenantCode varchar(20), 
	@ContratAnnonceur varchar(20)
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

    SELECT @TenantCode as 'TenantCode'
		, a.affiche_id AS 'IdPoster'
		, a.theme AS 'Theme'  
		, ISNULL(a.repiquage, '') AS 'Repiquage'
		, Coalesce(CONVERT(varchar, CAST(a.date_entree AS DATETIME), 120), '') AS 'EntryDate'
		, Coalesce(CONVERT(varchar, date_derniere_sortie, 120), '') AS 'WithdrawalDate'
		--CAST(a.date_entree AS DATE) AS 'EntryDate',
		--CAST(date_derniere_sortie AS DATE) AS 'WithdrawalDate',
		, a.conservation AS 'Conservation'
		, SUM (m.quantite) AS 'Quantity'
	FROM affiche a
	INNER JOIN mouvement m on a.affiche_id = m.affiche_id 
	WHERE a.cont_annonc like @ContratAnnonceur
	GROUP BY a.affiche_id
		, a.theme 
		, ISNULL(a.repiquage, '')
		, Coalesce(CONVERT(varchar, CAST(a.date_entree AS DATETIME), 120), '')
		, Coalesce(CONVERT(varchar, date_derniere_sortie, 120), '')
		, a.conservation
	ORDER BY SUM (m.quantite) desc
END
GO
/****** Object:  StoredProcedure [dbo].[p_s_instruction_scro]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[p_s_instruction_scro] 
	@user			varchar(50),
	@numsemaine		varchar(2),
	@numannee		varchar(4),
    @ate_id         smallint
AS
BEGIN
	-- =============================================
	-- Author:		SJA
	-- Create date: 12/04/07
	-- Description:	Affiche la liste des répaartitions a traiter
	-- =============================================
	-- Date			| User			| Description
	-- -----------------------------------------------------------------------
	-- 12-08-2014	| SJA.			| Création
	-- -----------------------------------------------------------------------
	-- 2016-02-02	| Wheeler A.	| ajout colonne rpc_statut
	-- -----------------------------------------------------------------------

	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
	SET FMTONLY OFF;
    
    select @user = upper (@user)

    -- obligatoire : User/numsemaine/numannée
    
   
	if (@numsemaine = '' or @numsemaine = 0)  set @numsemaine = NULL
	if (@numannee = '' or @numannee = 0)  set @numannee = NULL
    
     
select 
tf_face_train.instr_code,	
ate_lib	,
--isnull (instruction_train.cont_num,instruction_train.rese_ident) contrat,
tsr_repart_nom	,
t.rpc_statut,
statut_nom	,
instr_annonceur	,
--isnull( instr_dat_maj, instr_dat_cre) as 'date_instruction',
dest_nom_ori destinataire ,
sup_nom,
count (cadr_ident) as 'nb'
into #t
FROM tf_face_train
    JOIN instruction_train t ON (tf_face_train.instr_code = t.instr_code)
    JOIN tr_utilisateur_data ON (t.ate_id = tr_utilisateur_data.ate_id)
    JOIN tr_atelier ON (t.ate_id = tr_atelier.ate_id)
    JOIN tr_statut ON (t.rpc_statut = tr_statut.rpc_statut)
    JOIN tr_statut_repart ON (t.tsr_repart_code = tr_statut_repart.tsr_repart_code)
    JOIN tr_destinataire ON (tf_face_train.dest_id= tr_destinataire.dest_id)
    JOIN tr_categorie_support ON (tf_face_train.sup_id = tr_categorie_support.sup_id)

where
tf_face_train.dep_anbas	= convert (smallint, @numannee)
and tf_face_train.dep_sembas	= convert (tinyint,@numsemaine)
and tr_utilisateur_data.loginWindows = @user
and t.ate_id = @ate_id

group by
tf_face_train.instr_code,	
ate_lib	,
tsr_repart_nom	,
t.rpc_statut,
statut_nom	,
instr_annonceur	,
sup_nom,
dest_nom_ori

     
    -- pour la gestion des anomalies
	if @@error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), 'p_s_instruction_scro', '#t', @user
        return 1
	end
  
select 
#t.instr_code,	
#t.sup_nom	,
isnull (instruction_train.cont_num,instruction_train.rese_ident) contrat,
#t.tsr_repart_nom	,
#t.rpc_statut,
#t.statut_nom	,
#t.instr_annonceur	,
isnull( instr_dat_maj, instr_dat_cre) as 'date_instruction',
#t.destinataire,
#t.nb,
instr_commentaire
    from #t, instruction_train
    where  #t.instr_code = instruction_train.instr_code
    
	-- fin de la procedure
	return 0
END
;
GO
/****** Object:  StoredProcedure [dbo].[p_s_instrucVisuelPourUnContrat]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[p_s_instrucVisuelPourUnContrat]
	@instr_code varchar(18)
AS
begin
	-- Description: Affiche la liste des themes pour un contrat pour une semaine
	--		retourne un seul des ateliers pour le 2 m² et 1 seule pour le 8 m²
	-- 
	-- Date			| Utilisateur	| Description
	-- -----------------------------------------------------------------------
	-- 2016.10.18	| Wheeler A.	| Création
	
	declare @cont_num int,
		@rese_ident int,
		@cont_anbas smallint,
		@cont_sembas smallint
	/*
	create table #temp
	(
		dimension varchar(10) null,
		ate_id smallint null
	)
	*/
	-- on recupere les données de contrat
	select @cont_num = cont_num,
		@rese_ident = rese_ident,
		@cont_anbas = cont_anbas,
		@cont_sembas = cont_sembas
	from instruction_train
	where instr_code = @instr_code

	-- comme on doit afficher le regroupement des themes pour le 2 m et pour le 8 m.
	-- on selectionne un seul atelier pour le 2 m et un seul pour le 8 m 
	-- rappel : theoriquement les themes pour repartie correctement par ateliers
	
	-- on recupere donc les ateliers
	
	select convert(varchar(10),'2 m²') as dimension, min(ate_id) as ate_id
	into #temp
	from instruction_train 
	where (cont_num = @cont_num or rese_ident = @rese_ident)
	and cont_anbas = @cont_anbas
	and cont_sembas = @cont_sembas
	and ate_id in (5,6)

	insert #temp
	select '8 m²', min(ate_id)
	from instruction_train 
	where (cont_num = @cont_num or rese_ident = @rese_ident)
	and cont_anbas = @cont_anbas
	and cont_sembas = @cont_sembas
	and ate_id in (7,8)


	insert #temp
	select '4 m²', min(ate_id)
	from instruction_train 
	where (cont_num = @cont_num or rese_ident = @rese_ident)
	and cont_anbas = @cont_anbas
	and cont_sembas = @cont_sembas
	and ate_id in (11,12)


	-- on retourne les thmes des ateliers selectionnées
	select v.insv_id, 
		v.instr_code,
		t.dimension,
		v.insv_afch_ident,
		v.insv_theme, 
		v.tpr_id,
		v.insv_pourcentage,
		v.insv_user
	from #temp t
	join instruction_train i on (t.ate_id = i.ate_id)
	join instruction_visuels v on (i.instr_code = v.instr_code)
	where (i.cont_num = @cont_num or i.rese_ident = @rese_ident)
	and i.cont_anbas = @cont_anbas
	and i.cont_sembas = @cont_sembas

	RETURN 0
end
GO
/****** Object:  StoredProcedure [dbo].[p_s_liste_adresse]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[p_s_liste_adresse] 
AS
BEGIN
	-- =============================================================
	-- Author:		PCL
	-- Create date: 25/03/15
	-- Description:	Retourne la liste des adresses
	-- =============================================================
	-- Date			| User			| Description
	-- -----------------------------------------------------------------------
	-- 25-03-2015	| PCL.			| Création
	-- -----------------------------------------------------------------------
	-- 2016-02-09	| Wheeler A.	| ajout de la colonne de la commune calberson
	-- -----------------------------------------------------------------------

	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	set nocount on;

	select dest.dest_id,
		dest.dest_nom,
		dest.dest_actif,
		dest.dest_dispatch,
		dest.des_type,
		adr.adr_id,
		adr.tad_cod,
		adr.adr_code_postal as code_postal,
		adr.adr_localite as localite,
		typeAdr.tad_lib,
		typeDest.type_nom,
		cc.calb_commune
	from tr_destinataire dest
	join tr_dest_adresse adr on dest.dest_id = adr.dest_id
	join tr_type_adresse typeAdr on adr.tad_cod = typeAdr.tad_cod
	join tr_type_destination typeDest on dest.des_type = typeDest.des_type
	left join tr_communes_calber cc on (adr.calb_id = cc.calb_id)
	order by dest.dest_dat_maj desc      
    
	-- fin de la procedure
	return 0
end
GO
/****** Object:  StoredProcedure [dbo].[p_s_listeActivite]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


create procedure [dbo].[p_s_listeActivite]
(
	@loginWindows		varchar(50),
	@rpc_statut			tinyint
)
as
begin
	-- description : donne la liste des activites
	--
	-- 2013.10.29	| Wheeler A.	| Creation

	select distinct a.act_id, 
		a.act_nom
	from tr_activite a
	join tf_repart_calcul r on (a.act_id = r.act_id)
	join tr_utilisateur u on (r.ate_id = u.ate_id)
	where u.loginWindows = @loginWindows
	and r.rpc_statut = @rpc_statut
	and a.act_id > 0
	and r.numeroReception is not null
	order by a.act_nom

	if @@error <> 0
		return -1

	-- fin de la procedure
	return 0
end
GO
/****** Object:  StoredProcedure [dbo].[p_s_listeAnnonceur]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO



CREATE procedure [dbo].[p_s_listeAnnonceur]
(
	@loginWindows			varchar(50),
	@rpc_statut				tinyint,
	@numeroReceptionIsNull	bit,
	@sem_num				tinyint,
	@sem_annee				smallint
)
as
begin	
	-- description : donne la liste des annonceurs en fonction
	--				de l'atelier de l'utilisateur et du statut des repartitions
	--
	-- 2013.10.21	| Wheeler A.	| Creation
	
	select distinct rpc_annonceur collate Latin1_General_CS_AI as rpc_annonceur
	from tf_repart_calcul r
	join tr_utilisateur u on (r.ate_id = u.ate_id)
	where u.loginWindows = @loginWindows
	and rpc_statut = @rpc_statut
	and (	(@numeroReceptionIsNull = 0 and r.numeroReception is not null)
		or	(@numeroReceptionIsNull = 1 and r.numeroReception is null))
	and r.sem_num = @sem_num			-- numero de semaine
	and r.sem_annee = @sem_annee		-- annee
	order by rpc_annonceur collate Latin1_General_CS_AI

	-- fin de la procedure
	return 0
end

GO
/****** Object:  StoredProcedure [dbo].[p_s_listeAtelier]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


create procedure [dbo].[p_s_listeAtelier]
(
	@loginWindows	varchar(50)
)
as
begin
	-- description : donne la liste des ateliers et le nom de la plateforme
	--					disponible pour l'utilisateur
	--					tient compte du type de profil si profil plateforme ou
	--					adminisatrteur alors il y a plusieurs atelier possible
	--
	-- 2013.10.18	| Wheeler A.	| Creation

	-- declaration
	declare @ate_id smallint,
		@plt_id		tinyint

	-- on recupere l'atelier la plateforme de l'utilisateur
	-- si le profil est de type atelier 1 on recupere l'atelier
	-- si le profil est de type plateforme 2 on recupere la plateforme
	-- si le profil est de type administrateur 3 on recupere aucun identifiant
	select @ate_id = case when u.prf_id = 1 then u.ate_id else null end,
		@plt_id = case when u.prf_id = 2 then a.plt_id else null end
	from tr_utilisateur u
	join tr_atelier a on (u.ate_id = a.plt_id)
	where u.loginWindows = @loginWindows
	
	if @@error <> 0
		goto erreur

	-- on retourne la liste des ateliers disponible pour l'utilisateur
	select a.ate_id,
		p.plt_nom +' - '+ a.ate_lib as ate_lib
	from tr_atelier a
	join tr_plateforme p on (a.plt_id = p.plt_id)
	where a.ate_id <> 0
	and a.ate_id = isnull(@ate_id, a.ate_id)
	and p.plt_id = isnull(@plt_id, p.plt_id)
	order by a.ate_id

	if @@error <> 0
		goto erreur
	
	-- fin de la procedure
	return 0

erreur:
	-- fin de la procedure en erreur
	return -1
end
GO
/****** Object:  StoredProcedure [dbo].[p_s_listeFormat]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


create procedure [dbo].[p_s_listeFormat]
(
	@loginWindows			varchar(50),
	@rpc_statut				tinyint,
	@numeroReceptionIsNull	bit
)
as
begin
	-- description : donne la liste des formats de repartitions
	--
	-- 2013.10.21	| Wheeler A.	| Creation

	select distinct r.sup_id,
		s.sup_nom
	from tr_utilisateur u 
	join tf_repart_calcul r on (u.ate_id = r.ate_id)
	join tr_categorie_support s on (r.sup_id = s.sup_id)
	where u.loginWindows = @loginWindows
	and rpc_statut = @rpc_statut
	and (	(@numeroReceptionIsNull = 0 and r.numeroReception is not null)
		or	(@numeroReceptionIsNull = 1 and r.numeroReception is null))
	order by s.sup_nom
	/*
	select distinct r.sup_id,
		s.sup_nom
	from tr_utilisateur u 
	join tr_atelier_support a on (u.ate_id = a.ate_id)
	join tr_categorie_support s on (a.sup_id = s.sup_id)
	join tf_repart_calcul r on (a.ate_id = r.ate_id
								and s.sup_id = r.sup_id)
	where u.loginWindows = @loginWindows
	and rpc_statut = @rpc_statut
	and (	(@numeroReceptionIsNull = 0 and r.numeroReception is not null)
		or	(@numeroReceptionIsNull = 1 and r.numeroReception is null))
	order by s.sup_nom
	*/

	if @@error <> 0
		return -1

	-- fin de la procedure
	return 0
end
GO
/****** Object:  StoredProcedure [dbo].[p_s_listemail_repart]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================
-- Author:		SJA
-- Create date: 12/04/07
-- Description:	Affiche les mails pour envoyer déblocage répartition
-- =============================================
-- Date			| User			| Description
-- -----------------------------------------------------------------------
-- 12-08-2014	| SJA.	| Création
-- -----------------------------------------------------------------------
CREATE PROCEDURE [dbo].[p_s_listemail_repart] 
	
    
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
	select plt_mail from tr_plateforme

	return 0
END

;
GO
/****** Object:  StoredProcedure [dbo].[p_s_listemenu]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[p_s_listemenu] 
	@user			varchar(50)
    
AS
BEGIN
	-- =============================================
	-- Author:		SJA
	-- Create date: 12/04/07
	-- Description:	Affiche la liste des répaartitions a traiter
	-- =============================================
	-- Date			| User			| Description
	-- -----------------------------------------------------------------------
	-- 12-08-2014	| SJA.			| Création
	-- -----------------------------------------------------------------------
	-- 2016.02.12	| SJA.			| correction ajout upper
	-- -----------------------------------------------------------------------

	select @user = upper (@user)

	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
	-- on recupere le site de l'utilisateur
	select menu 
	from tr_utilisateur_menu
	where loginWindows = @user

	return 0
END

;
GO
/****** Object:  StoredProcedure [dbo].[p_s_listeprepa_pliage]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[p_s_listeprepa_pliage] 
	@user			    varchar(50),
	@numsemaine		    varchar(2),
	@numannee		    varchar(4),
	@numsemaine_au		varchar(2),
	@numannee_au		varchar(4)
    
    
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
	SET FMTONLY OFF;

    -- obligatoire : User/numsemaine/numann�e
    select @user = Upper (@user)
    
	if (@numsemaine = '' or @numsemaine = 0)  set @numsemaine = NULL
	if (@numannee = '' or @numannee = 0)  set @numannee = NULL
	    
    if (@numsemaine_au = '' or @numsemaine_au = 0)  set @numsemaine_au = NULL
	if (@numannee_au = '' or @numannee_au = 0)  set @numannee_au = NULL
	
    select @user = upper (@user)
    

	 CREATE table #affiche_recu(
	  cont_num int null,
	  cont_annonc varchar(100) null,
	  sup_id smallint null ,
	  theme varchar(50) null,
	  affiche_id int null,
	  validationAdmin bit null
	 )
	 -- r�cuperer les affiches valid�es
	 
insert into #affiche_recu (cont_num,cont_annonc,sup_id,theme,affiche_id,validationAdmin)	
       SELECT  tf.cont_num,tf.rpc_annonceur,tf.sup_id,tf.rpc_theme,affiche_id,validationAdmin
        from affiche aff join tf_prepa_affiche tf on aff.affiche_id = tf.affiche_livraison_Id
	     where sem_num = @numsemaine and sem_annee = @numannee and validationAdmin = 1 

SELECT CONVERT(varchar, tf_repart_calcul.rpc_dat_aff, 103) AS Date_aff, 
		tr_type_preparation.tpr_lib AS TypePrepa, 
		tf_repart_calcul.rpc_repartition as rpc_repartition, 
        tf_repart_calcul.cont_num as cont_num, 
		tf_repart_calcul.rpc_annonceur AS Annonceur, 
		tf_repart_calcul.rpc_theme AS Theme, 
		tr_destinataire.dest_nom_ori AS Destinataire, 
		tr_dest_adresse.adr_localite AS Destination, 
		null AS Transporteur, 
		tf_repart_calcul.rpc_qte AS Quantite, 
		tf_repart_calcul.rpc_id AS rpc_id,
		tr_categorie_support.sup_nom AS sup_nom,
		tr_categorie_support.sup_qte_UM AS sup_qte_UM,
		tf_repart_calcul.sup_id AS sup_id, 
        tf_repart_calcul.pers_ident AS pers_ident,
        tf_repart_calcul.pers_nom as afficheur,
        null as adr_1,
        null as adr_2,
        null as adr_3,
        null as postal,
        null as localite,
        null as tel,
        null as fax,
        isnull (tr_destinataire.dest_dispatch,'N') AS dispatch,
        tf_repart_calcul.rpc_num_aff_amt as num_aff_amt,
        tr_categorie_support.sup_poids as sup_poids,
        tf_repart_calcul.rpc_statut as statut,
    	tf_repart_calcul.ate_id as ate_id,
        tf_repart_calcul.tpr_id as tpr_id,
        tf_repart_calcul.dest_id as dest_id,
        convert (int,null) as 'nb',
		null as affiche_id
        into #t
	FROM tf_repart_calcul 
    JOIN tr_type_preparation ON (tf_repart_calcul.tpr_id = tr_type_preparation.tpr_id)
	JOIN tr_categorie_support ON (tf_repart_calcul.sup_id = tr_categorie_support.sup_id)
    JOIN tr_utilisateur_data ON (tf_repart_calcul.ate_id = tr_utilisateur_data.ate_id)
    JOIN tr_destinataire ON (tf_repart_calcul.dest_id = tr_destinataire.dest_id)
    JOIN tr_dest_adresse ON (tr_destinataire.dest_id = tr_dest_adresse.dest_id)
	where
        -- r�partition � traiter
    rpc_statut = 0
	--done
    and tf_repart_calcul.ate_id  in (2,3,9,10)
    and (tf_repart_calcul.sem_num >= @numsemaine)
	and (tf_repart_calcul.sem_annee >= @numannee)
    and (tf_repart_calcul.sem_num <= @numsemaine_au)
	and (tf_repart_calcul.sem_annee <= @numannee_au)
    and tr_utilisateur_data.loginWindows = @user
    and tr_dest_adresse.adr_principale = '1'
	and tf_repart_calcul.rpc_qte != 0
 order by rpc_dat_aff    
    

    select cont_num, rpc_repartition, sup_id, count (tf_repart_calcul.rpc_id) as nb
    into #t2
    from tf_repart_calcul
    JOIN tr_utilisateur_data ON (tf_repart_calcul.ate_id = tr_utilisateur_data.ate_id)
    where 
	--done
    tf_repart_calcul.ate_id  in (2,3,9,10)
    and tf_repart_calcul.sem_num > @numsemaine_au
	and tf_repart_calcul.sem_annee >= @numannee
    and tr_utilisateur_data.loginWindows = @user
    group by cont_num, rpc_repartition, sup_id
    
   
    select cont_num, rpc_repartition, sup_id, rpc_theme , 
    max (convert(varchar ,tf_repart_calcul.sem_annee) + right ('0' + convert(varchar ,tf_repart_calcul.sem_num),2)) as 'S'
	into #t3
    from tf_repart_calcul
    JOIN tr_utilisateur_data ON (tf_repart_calcul.ate_id = tr_utilisateur_data.ate_id)
    where 
    tf_repart_calcul.ate_id  in (2,3)
    and tf_repart_calcul.sem_num > @numsemaine_au
	and tf_repart_calcul.sem_annee >= @numannee
    and tr_utilisateur_data.loginWindows = @user
    group by cont_num, rpc_repartition, sup_id, rpc_theme
    
    update #t set #t.nb = convert ( int ,right ( #t3.S ,2))
    from #t3
    where #t.cont_num = #t3.cont_num
    and #t.rpc_repartition = #t3.rpc_repartition
    and #t.sup_id = #t3.sup_id 
    and #t.Theme = #t3.rpc_theme 


	-- mettre � jours les champs affiche_id + validationAdmin pour les affiches recues 
    UPDATE #t
      SET #t.affiche_id = s.affiche_id
       FROM #affiche_recu s
        INNER JOIN #t t
 	      ON t.cont_num = s.cont_num
		   where t.Annonceur = s.cont_annonc and t.sup_id = s.sup_id and t.Theme = s.theme
    



    select * from #t
   
   
	-- fin de la procedure
	return 0
END
;
;;

GO
/****** Object:  StoredProcedure [dbo].[p_s_listeprepa2m2]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[p_s_listeprepa2m2] 
	@user			varchar(50),
	@numsemaine		varchar(2),
	@numannee		varchar(4)  
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
    -- obligatoire : User/numsemaine/numannée
    
    select @user = upper (@user)
    
	if (@numsemaine = '' or @numsemaine = 0)  set @numsemaine = NULL
	if (@numannee = '' or @numannee = 0)  set @numannee = NULL
	    
	

SELECT CONVERT(varchar, tf_repart_calcul.rpc_dat_aff, 103) AS Date_aff, 
		tr_type_preparation.tpr_lib AS TypePrepa, 
		tf_repart_calcul.rpc_repartition as rpc_repartition, 
        tf_repart_calcul.cont_num as cont_num, 
		tf_repart_calcul.rpc_annonceur AS Annonceur, 
		tf_repart_calcul.rpc_theme AS Theme, 
		tr_destinataire.dest_nom_ori AS Destinataire, 
		tr_dest_adresse.adr_localite AS Destination, 
		null AS Transporteur, 
		tf_repart_calcul.rpc_qte AS Quantite, 
		tf_repart_calcul.rpc_id AS rpc_id,
		tr_categorie_support.sup_nom AS sup_nom,
		tr_categorie_support.sup_qte_UM AS sup_qte_UM,
		tf_repart_calcul.sup_id AS sup_id, 
        tf_repart_calcul.pers_ident AS pers_ident,
        tf_repart_calcul.pers_nom as afficheur,
        null as adr_1,
        null as adr_2,
        null as adr_3,
        null as postal,
        tr_dest_adresse.adr_localite as localite,
        null as tel,
        null as fax,
        isnull (tr_destinataire.dest_dispatch,'N') AS dispatch,
        tf_repart_calcul.rpc_num_aff_amt as num_aff_amt,
        tr_categorie_support.sup_poids as sup_poids,
        tf_repart_calcul.rpc_statut as statut,
    	tf_repart_calcul.ate_id as ate_id,
        tf_repart_calcul.tpr_id as tpr_id,
        tf_repart_calcul.dest_id as dest_id,
		tf_repart_calcul.rpc_repiquage as rpc_repiquage
	FROM tf_repart_calcul
    JOIN tr_type_preparation ON (tf_repart_calcul.tpr_id = tr_type_preparation.tpr_id)
	JOIN tr_categorie_support ON (tf_repart_calcul.sup_id = tr_categorie_support.sup_id)
    JOIN tr_utilisateur_data ON (tf_repart_calcul.ate_id = tr_utilisateur_data.ate_id)
    JOIN tr_destinataire ON (tf_repart_calcul.dest_id = tr_destinataire.dest_id)
	JOIN tr_dest_adresse ON (tr_destinataire.dest_id = tr_dest_adresse.dest_id)
	   
where
    -- répartition à traiter
    rpc_statut = 0
    and tf_repart_calcul.ate_id  in (1,4)
    and (tf_repart_calcul.sem_num = @numsemaine or @numsemaine is null)
	and (tf_repart_calcul.sem_annee = @numannee or @numannee is null)
    and tr_utilisateur_data.loginWindows = @user
    and tr_dest_adresse.adr_principale = '1'
	and tf_repart_calcul.rpc_qte != 0
 order by rpc_dat_aff    
    
    
    
	-- fin de la procedure
	return 0
END
;
;
GO
/****** Object:  StoredProcedure [dbo].[p_s_listeTypePreparation]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


CREATE procedure [dbo].[p_s_listeTypePreparation]
(
	@loginWindows	varchar(50),
	@rpc_statut		tinyint
)
as
begin
	-- description : donne la liste des types de preparations
	--
	-- 2013.10.29	| Wheeler A.	| Creation

	select distinct r.tpr_id,
		t.tpr_lib collate Latin1_General_CS_AI as tpr_lib
	from tr_type_preparation t
	join tf_repart_calcul r on (t.tpr_id = r.tpr_id)
	join tr_utilisateur u on (r.ate_id = u.ate_id)
	where u.loginWindows = @loginWindows
	and r.rpc_statut = @rpc_statut
	and r.numeroReception is not null
	order by tpr_lib collate Latin1_General_CS_AI

	if @@error <> 0
		return -1

	-- fin de la procedure
	return 0
end

GO
/****** Object:  StoredProcedure [dbo].[p_s_listeUM_2m2]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================
-- Author:		SJAO
-- Create date: 16/09/14
-- Description:	Affiche la liste des UM 2m2
-- =============================================
-- Date			| User			| Description
-- -----------------------------------------------------------------------
-- 04-06-2026   | AKH	| Ajout colonne UM_date_aff pour préparation 2m2 fixe
-- 27-05-2019   | YBE	| ajout filtre sur plt_id
-- 04-01-2018   | Ojerbi | Ajout de affiche_id + validationAdmin (module réception)
-- 11-07-2017	| SJA.	| Ajout de repiquage 
-- 02-06-2016   | SJA.	| supression tr_dsetination
-- 17-03-2015	| PCL.	| Prise en compte des données de colisage
-- 12-08-2014	| SJA.	| Création
-- -----------------------------------------------------------------------
CREATE PROCEDURE [dbo].[p_s_listeUM_2m2] 
	@user			varchar(50),
	@numsemaine		varchar(2),
	@numannee		varchar(4)

AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
    SET FMTONLY OFF
	
    select @user = upper (@user)
    
    -- obligatoire : User/numsemaine/numannée
    
	-- declaration
	declare @ate_id smallint

    
	if (@numsemaine = '' or @numsemaine = 0)  set @numsemaine = NULL
	if (@numannee = '' or @numannee = 0)  set @numannee = NULL

	
	 CREATE table #affiche_recu(
	  cont_num int null,
	  cont_annonc varchar(100) null,
	  sup_id smallint null ,
	  theme varchar(50) null,
	  affiche_id int null,
	  validationAdmin bit null,
	  plt_id int null
	 )

	 insert into #affiche_recu (cont_num,cont_annonc,sup_id,theme,affiche_id,validationAdmin,plt_id)	
       SELECT  tf.cont_num,tf.rpc_annonceur,tf.sup_id,tf.rpc_theme,affiche_id,validationAdmin, tf.plt_id
        from affiche aff join tf_prepa_affiche tf on aff.affiche_id = tf.affiche_livraison_Id
	     where sem_num = @numsemaine and sem_annee = @numannee and validationAdmin = 1


	CREATE table #listeUM_2m2(TypePrepa varchar(50) null, Destinataire varchar(50) null,Destination varchar(50) null,sup_nom varchar(50) null,UM_id int null,
	 rpc_statut tinyint null,sup_id smallint null,sem_num tinyint null,sem_annee smallint null,repartition numeric null,annonceur varchar(50) null,theme varchar(50) null,
	 repiquage varchar(50) null,qte int null,cont_num int null,pers_ident numeric null,afficheur varchar(50) null,code_barre varchar(50) null,
	 code_synthese varchar(50) null,poids numeric null,adr_1 varchar(50) null,adr_2 varchar(50) null,adr_3 varchar(50) null,postal varchar(50) null,localite varchar(50) null,
	 tel varchar(15) null,fax varchar(15) null,num_aff_amt numeric null,statut_nom varchar(50) null,dest_id int null,UM_comment varchar(50) null,colis_id int null,
	 colis_code varchar(50) null,colis_statut tinyint null,uc_qte int null,UM_date_aff smalldatetime null,ate_id smallint null,affiche_id int null,validationAdmin bit null, plt_id int null
	)

	Insert into #listeUM_2m2 (TypePrepa,Destinataire,Destination,sup_nom,UM_id,rpc_statut,sup_id,sem_num,sem_annee,repartition,annonceur,theme,repiquage,qte,cont_num,pers_ident,afficheur,
	                          code_barre,code_synthese,poids,adr_1,adr_2,adr_3,postal,localite,tel,fax,num_aff_amt,statut_nom,dest_id,UM_comment,colis_id,colis_code,colis_statut,uc_qte,
							  UM_date_aff,ate_id,affiche_id,validationAdmin,plt_id)

SELECT 	
   tr_type_preparation.tpr_lib AS TypePrepa, 
   tr_destinataire.dest_nom_ori AS Destinataire, 
   tr_dest_adresse.adr_localite AS Destination, 
   tr_categorie_support.sup_nom As sup_nom,
   tf_UM.UM_id as UM_id,
   tf_UM.rpc_statut as rpc_statut,
   tf_UM.sup_id as sup_id,
   tf_UM.sem_num as sem_num,
   tf_UM.sem_annee as sem_annee,
   tf_UM.UM_repartition as repartition,
   tf_UM.UM_annonceur as annonceur,
   tf_UM.UM_theme    as theme,
   tf_UM.UM_Repiquage as repiquage,
   tf_UM.UM_qte      as qte ,
   tf_UM.cont_num    as cont_num,
   tf_UM.pers_ident  as pers_ident,
   tf_UM.pers_nom    as afficheur,
   tf_UM.UM_code_barre as code_barre,
   tf_UM.UM_code_synthese as code_synthese,
   tf_UM.UM_poids as poids ,
   convert (varchar( 50),isnull (tr_dest_adresse.adr_num_voie,'') + 
   isnull (tr_dest_adresse.adr_type_voie,'') +
   isnull (tr_dest_adresse.adr_voie,'') ) as adr_1, 
   convert (varchar (50), isnull (tr_dest_adresse.adr_lieu_dit,''))  as adr_2,
   convert (varchar (50), null) as adr_3,
   tr_dest_adresse.adr_code_postal as postal,
   tr_dest_adresse.adr_localite as localite,
   convert ( varchar(15), null) as tel,
   convert ( varchar(15), null) as fax,
   tf_UM.UM_num_aff_amt as num_aff_amt,
   tr_statut.statut_nom as statut_nom,
   tf_UM.dest_id as dest_id,
   tf_UM.UM_comment as UM_comment,
   ISNULL(tf_colis.colis_id,0) as colis_id,
   tf_colis.colis_code as colis_code,
   tf_colis.rpc_statut as colis_statut,
   tf_UM_colis.uc_qte as uc_qte,
   tf_UM.UM_date_aff as UM_date_aff,
   tf_UM.ate_id as ate_id,
   -- ajout des colonnes affiche_id + validationLivraison (module réception)
   Null,
   Null,
   tr_atelier.plt_id as plt_id

    FROM tf_UM 
    JOIN tr_type_preparation ON (tf_UM.tpr_id = tr_type_preparation.tpr_id)
	JOIN tr_categorie_support ON (tf_UM.sup_id = tr_categorie_support.sup_id)
    JOIN tr_utilisateur_data ON (tf_UM.ate_id = tr_utilisateur_data.ate_id)
    Join tr_statut on ( tf_UM.rpc_statut = tr_statut.rpc_statut)
    JOIN tr_destinataire ON (tf_UM.dest_id = tr_destinataire.dest_id)
    JOIN tr_dest_adresse ON (tr_destinataire.dest_id = tr_dest_adresse.dest_id)
	LEFT JOIN tf_UM_colis ON (tf_UM_colis.UM_id = tf_UM.UM_id)
	LEFT JOIN tf_colis    ON (tf_colis.colis_id = tf_UM_colis.colis_id)
	JOIN tr_atelier on (tf_UM.ate_id = tr_atelier.ate_id)
	
where
    -- répartition à traiter
    tf_UM.rpc_statut not in (3,4)
    and tf_UM.ate_id  in (1,4)
    and tr_dest_adresse.adr_principale = '1'
    and (tf_UM.sem_num = @numsemaine or @numsemaine is null)
	and (tf_UM.sem_annee = @numannee or @numannee is null)
    and tr_utilisateur_data.loginWindows = @user

	
	
	-- mettre à jours les champs affiche_id + validationAdmin pour les affiches recues 
    UPDATE t
      SET t.affiche_id = s.affiche_id, t.validationAdmin = s.validationAdmin
       FROM #listeUM_2m2 t
        INNER JOIN #affiche_recu s
 	      ON t.cont_num = s.cont_num and t.plt_id = s.plt_id
		   where t.annonceur = s.cont_annonc and t.sup_id = s.sup_id and t.theme = s.theme
    

	select distinct TypePrepa , Destinataire ,Destination ,sup_nom ,UM_id ,
	 rpc_statut ,sup_id ,sem_num ,sem_annee ,repartition ,annonceur ,theme ,
	 repiquage ,qte ,cont_num ,pers_ident ,afficheur ,code_barre ,
	 code_synthese ,poids,adr_1 ,adr_2 ,adr_3 ,postal ,localite ,
	 tel ,fax ,num_aff_amt,statut_nom ,dest_id ,UM_comment ,colis_id ,
	 colis_code ,colis_statut ,uc_qte, UM_date_aff ,ate_id ,affiche_id ,validationAdmin
	  from #listeUM_2m2
	
	drop table #listeUM_2m2
	drop table #affiche_recu

	-- fin de la procedure
	return 0
END
;;

GO
/****** Object:  StoredProcedure [dbo].[p_s_listeUM_pliage]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[p_s_listeUM_pliage] 
	@user			varchar(50),
	@numsemaine		varchar(2),
	@numannee		varchar(4)
AS
BEGIN
	-- Description:	Affiche la liste des UM 2m2
	--
	-- =============================================
	-- Date			| User			| Description
	-- ---------------------------------------------------------------------
	-- 09-01-2018   | Ojerbi        | Ajout de affiche_id + validationAdmin (module r?ception)
	-- 12-08-2014	| SJA.			| Cr?ation
	-- 17-03-2015	| PCL.			| Prise en compte des donn?es de colisage
	-- 2015.12.14	| Wheeler A.	| ajout des colonnes UM_date_aff et UM_dat_cre 
	--				|				| dans le resultat
    -- 2016-06-02	| SJA.			| suppression tf_destination
	-- 2019-05-27   | YBE			| ajout filtre sur plt_id
	-- -----------------------------------------------------------------------
	    
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	SET FMTONLY OFF

    select @user = upper (@user)
    -- obligatoire : User/numsemaine/numann?e
    
	-- declaration
	declare @ate_id smallint

    
	if (@numsemaine = '' or @numsemaine = 0)  set @numsemaine = NULL
	if (@numannee = '' or @numannee = 0)  set @numannee = NULL
	

	CREATE table #affiche_recu(
	  cont_num int null,
	  cont_annonc varchar(100) null,
	  sup_id smallint null ,
	  theme varchar(50) null,
	  affiche_id int null,
	  validationAdmin bit null,
	  plt_id int null
	 )

	 insert into #affiche_recu (cont_num,cont_annonc,sup_id,theme,affiche_id,validationAdmin,plt_id)	
       SELECT  tf.cont_num,tf.rpc_annonceur,tf.sup_id,tf.rpc_theme,affiche_id,validationAdmin, tf.plt_id
        from affiche aff join tf_prepa_affiche tf on aff.affiche_id = tf.affiche_livraison_Id
	     where sem_num = @numsemaine and sem_annee = @numannee and validationAdmin = 1


    CREATE table #listeUM_pliage(TypePrepa varchar(50) null, Destinataire varchar(50) null,Destination varchar(50) null,sup_nom varchar(50) null,UM_id int null,
	 rpc_statut tinyint null,sup_id smallint null,sem_num tinyint null,sem_annee smallint null,repartition numeric null,annonceur varchar(50) null,theme varchar(50) null,
	 qte int null,cont_num int null,pers_ident numeric null,afficheur varchar(50) null,code_barre varchar(50) null,
	 code_synthese varchar(50) null,poids numeric null,adr_1 varchar(50) null,adr_2 varchar(50) null,adr_3 varchar(50) null,postal varchar(50) null,localite varchar(50) null,
	 tel varchar(15) null,fax varchar(15) null,num_aff_amt numeric null,statut_nom varchar(50) null,dest_id int null,UM_comment varchar(50) null,colis_id int null,
	 colis_code varchar(50) null,colis_statut tinyint null,uc_qte int null,UM_date_aff smalldatetime null,UM_dat_cre smalldatetime null,affiche_id int null,validationAdmin bit null, plt_id int null,ate_id smallint null
	)

	Insert into #listeUM_pliage (TypePrepa,Destinataire,Destination,sup_nom,UM_id,rpc_statut,sup_id,sem_num,sem_annee,repartition,annonceur,theme,qte,cont_num,pers_ident,afficheur,
	                          code_barre,code_synthese,poids,adr_1,adr_2,adr_3,postal,localite,tel,fax,num_aff_amt,statut_nom,dest_id,UM_comment,colis_id,colis_code,colis_statut,uc_qte,
							  UM_date_aff,UM_dat_cre,affiche_id,validationAdmin,plt_id,ate_id)

 SELECT 	
   tr_type_preparation.tpr_lib AS TypePrepa, 
   tr_destinataire.dest_nom_ori AS Destinataire, 
   tr_dest_adresse.adr_localite AS Destination, 
   tr_categorie_support.sup_nom As sup_nom,
   tf_UM.UM_id as UM_id,
   tf_UM.rpc_statut as rpc_statut,
   tf_UM.sup_id as sup_id,
   tf_UM.sem_num as sem_num,
   tf_UM.sem_annee as sem_annee,
   tf_UM.UM_repartition as repartition,
   tf_UM.UM_annonceur as annonceur,
   tf_UM.UM_theme    as theme,
   tf_UM.UM_qte      as qte ,
   tf_UM.cont_num    as cont_num,
   tf_UM.pers_ident  as pers_ident,
   tf_UM.pers_nom    as afficheur,
   tf_UM.UM_code_barre as code_barre,
   tf_UM.UM_code_synthese as code_synthese,
   tf_UM.UM_poids as poids ,
   convert (varchar( 50),isnull (tr_dest_adresse.adr_num_voie,'') + 
   isnull (tr_dest_adresse.adr_type_voie,'') +
   isnull (tr_dest_adresse.adr_voie,'') ) as adr_1, 
   convert (varchar (50), isnull (tr_dest_adresse.adr_lieu_dit,'')) as adr_2,
   convert (varchar (50), null) as adr_3,
   tr_dest_adresse.adr_code_postal as postal,
   tr_dest_adresse.adr_localite as localite,
   convert ( varchar(15), null) as tel,
   convert ( varchar(15), null) as fax,
   tf_UM.UM_num_aff_amt as num_aff_amt,
   tr_statut.statut_nom as statut_nom,
   tf_UM.dest_id as dest_id,
   tf_UM.UM_comment as UM_comment,
   ISNULL(tf_colis.colis_id,0) as colis_id,
   tf_colis.colis_code as colis_code,
   tf_colis.rpc_statut as colis_statut,
   tf_UM_colis.uc_qte as uc_qte,
   tf_UM.UM_date_aff,
   tf_UM.UM_dat_cre,
   Null,
   Null,
   tr_atelier.plt_id as plt_id,
   tr_atelier.ate_id as ate_id 
    FROM tf_UM 
    JOIN tr_type_preparation ON (tf_UM.tpr_id = tr_type_preparation.tpr_id)
	JOIN tr_categorie_support ON (tf_UM.sup_id = tr_categorie_support.sup_id)
    JOIN tr_utilisateur_data ON (tf_UM.ate_id = tr_utilisateur_data.ate_id)
    Join tr_statut on ( tf_UM.rpc_statut = tr_statut.rpc_statut)
    JOIN tr_destinataire ON (tf_UM.dest_id = tr_destinataire.dest_id)
	JOIN tr_dest_adresse ON (tr_destinataire.dest_id = tr_dest_adresse.dest_id)
    LEFT JOIN tf_UM_colis ON (tf_UM_colis.UM_id = tf_UM.UM_id)
	LEFT JOIN tf_colis    ON (tf_colis.colis_id = tf_UM_colis.colis_id)
	JOIN tr_atelier on (tf_UM.ate_id = tr_atelier.ate_id)
    
where
    tr_dest_adresse.adr_principale = '1'
    -- r?partition ? traiter
    and tf_UM.rpc_statut not in (3,4)
    and tf_UM.ate_id  in (2,3,9,10)
    and (tf_UM.sem_num = @numsemaine or @numsemaine is null)
	and (tf_UM.sem_annee = @numannee or @numannee is null)
    and tr_utilisateur_data.loginWindows = @user
   

   -- mettre ? jours les champs affiche_id + validationAdmin pour les affiches recues 
    UPDATE t
      SET t.affiche_id = s.affiche_id, t.validationAdmin = s.validationAdmin
       FROM #listeUM_pliage t
        INNER JOIN #affiche_recu s
 	      ON t.cont_num = s.cont_num and t.plt_id = s.plt_id
		   where t.annonceur = s.cont_annonc and t.sup_id = s.sup_id and t.theme = s.theme

    
	select * from #listeUM_pliage
	-- fin de la procedure
	return 0
	end;
GO
/****** Object:  StoredProcedure [dbo].[p_s_param_local_transporteur]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
create procedure [dbo].[p_s_param_local_transporteur]
(
	@tsp_id         int
)
as
begin
	-- description : retourne les données du paramétrage local d'un transporteur transporteur donné
	--
	-- 2015.06.01	| CLEMENT. P	| Creation

	
SELECT -- Transporteur
       trsp.tsp_id,
       trsp.tsp_nom,
	   trsp.tsp_inactif,
	   trsp.tsp_interne,
	   -- Param Local
	   ate.ate_id,
	   pltf.plt_nom,
	   ate.ate_lib,
	   trspa.tra_code_tiers,
	   trspa.tra_ip

	FROM tr_transporteur trsp
	INNER JOIN tr_transporteur_atelier trspa ON trsp.tsp_id = trspa.tsp_id
	INNER JOIN tr_atelier ate ON trspa.ate_id = ate.ate_id 
	INNER JOIN tr_plateforme pltf ON ate.plt_id = pltf.plt_id
	WHERE trsp.tsp_id = @tsp_id
	
    if @@error <> 0
		return -1
	
	-- fin de la procedure
	return 0
end
GO
/****** Object:  StoredProcedure [dbo].[p_s_plateforme]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[p_s_plateforme] 
	@user			varchar(50)
	
AS
BEGIN
	-- =============================================
	-- Author:		SJAO
	-- Create date: 16/09/14
	-- Description:	Affiche la plateforme de l'utilisateur
	-- =============================================
	-- Date			| User			| Description
	-- -----------------------------------------------------------------------
	-- 12-08-2014	| SJA.			| Création
	-- -----------------------------------------------------------------------
	-- 2016.02.16	| Wheeler A.	| correction ajout upper
	-- -----------------------------------------------------------------------
	
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
    -- obligatoire : User/numsemaine/numannée
    
	-- declaration
	declare @plt_id smallint

	-- upper du user
	select @user = upper(@user)

	-- on recupere le site de l'utilisateur
	select @plt_id = min (plt_id)
	from tr_utilisateur_data
	where loginWindows = @user

SELECT 	
plt_id,
   plt_nom,
   plt_adr_1,
   plt_adr_2,
   plt_postal,
   plt_localite,
   plt_tel
from tr_plateforme
where plt_id= @plt_id
 
   
  return 0
  
  
END
GO
/****** Object:  StoredProcedure [dbo].[p_s_preparation_externe_scro]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


CREATE PROCEDURE [dbo].[p_s_preparation_externe_scro] 
	@user			varchar(50),
	@dep_anbas		smallint,
	@dep_sembas		tinyint,
	@ate_id			smallint,
	@mode_affichage smallint,
	@pre_assemblage bit null
AS
BEGIN
	-- Description: Affiche la liste des th?mes au statut "export prepa"
	--
	-- -----------------------------------------------------------------------
	-- Date			| User			| Description
	-- -----------------------------------------------------------------------
	-- 2014.08.12	| SJA.			| Cr?ation
	-- -----------------------------------------------------------------------
	-- 2016.04.06	| Wheeler A.	| ajout du repiquage
	--				|				| suppression des colonnes inutile
	
    -- SET FMTONLY OFF;


select train_id, SUM(CASE WHEN ISNULL(pre_assemblage,0) = 0 THEN 0 ELSE 1 END) NombreFaceEnPreAssemblage, COUNT(train_id) NombreTrain
into #temp
from tf_face_train t
where t.dep_anbas = @dep_anbas
	  and t.dep_sembas = @dep_sembas
	  and t.ate_id = @ate_id
group by t.train_id


 if(@mode_affichage = 1)   
	begin
		select s.sup_nom,
		t.cont_annonc,
		t.theme,
		t.repiquage,
		'' as destinataire,
		count(*) as 'quantite'
		from tf_face_train t
		join tr_categorie_support s on (t.sup_id = s.sup_id)
		left join #temp tp on tp.train_id = t.train_id
		where t.dep_anbas = @dep_anbas
		and t.dep_sembas = @dep_sembas
		and t.ate_id = @ate_id
		and t.rpc_statut = 9	-- 9 Export pr?pa
		and (( @pre_assemblage = 1 AND isnull(t.pre_assemblage,0) = isnull(@pre_assemblage,0) AND tp.NombreFaceEnPreAssemblage = tp.NombreTrain)
			OR (isnull(@pre_assemblage,0) = 0)
	        )
		group by s.sup_nom, t.cont_annonc, t.theme, t.repiquage
    
	end
 else 
	begin
		select s.sup_nom,
			t.cont_annonc,
			t.theme,
			t.repiquage,
			isnull(d.dest_nom, '') as destinataire,
			count(*) as 'quantite'
		from tf_face_train t
		join tr_categorie_support s on (t.sup_id = s.sup_id)
		left join tr_destinataire d on t.dest_id = d.dest_id
		left join #temp tp on tp.train_id = t.train_id
		where t.dep_anbas = @dep_anbas
		and t.dep_sembas = @dep_sembas
		and t.ate_id = @ate_id
		and t.rpc_statut = 9	-- 9 Export pr?pa
		and (( @pre_assemblage = 1 AND isnull(t.pre_assemblage,0) = isnull(@pre_assemblage,0) AND tp.NombreFaceEnPreAssemblage = tp.NombreTrain)
			OR (isnull(@pre_assemblage,0) = 0)
	        )

		group by s.sup_nom, t.cont_annonc, t.theme, t.repiquage, d.dest_nom
	end
	 
	-- pour la gestion des anomalies
	if @@error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select getdate(), 'p_s_preparation_externe_scro', 'select', @user

		return 1
	end

	drop table #temp
	-- fin de la procedure
	return 0
END;

GO
/****** Object:  StoredProcedure [dbo].[p_s_profilUser]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


create procedure [dbo].[p_s_profilUser]
(
	@loginWindows	varchar(50)
)
as
begin
	-- description : retourne le profil de l'utilisateur
	--
	-- 2013.11.14	| Wheeler A.	| Creation

	select prf_id
	from tr_utilisateur
	where loginWindows = @loginWindows

	if @@error <> 0
		return -1
	
	-- fin de la procedure
	return 0
end
GO
/****** Object:  StoredProcedure [dbo].[p_s_rechercheRepartRecepAff]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


create procedure [dbo].[p_s_rechercheRepartRecepAff]
(
	@ate_id				smallint = null,
	@sem_num			tinyint = null,
	@sem_annee			smallint = null,
	@rpc_annonceur		varchar(50) = null,
	@rpc_theme			varchar(50) = null,
	@sup_id				smallint = null,
	@rpc_repartition	numeric(9,0) = null,
	@cont_num			int = null,
	@numero_reception	varchar(20) = null
)
as
begin
	-- description : recherche les repartitions pour l'ecran de
	--				repartition d'affiche
	--
	-- 2013.10.21	| Wheeler A.	| Creation

	select r.rpc_id,
		r.rpc_repartition,
		r.cont_num,
		r.sem_num,
		r.sem_annee,
		r.rpc_annonceur,
		r.rpc_theme,
		s.sup_nom,
		r.numeroReception,
		r.rpc_qte/*,
		-- pour les tests
		@ate_id as ate_id_1,
		@sem_num as sem_num_1,
		@sem_annee as sem_annee_1,
		@rpc_annonceur as rpc_annonceur_1,
		@rpc_theme as rpc_theme_1,
		@sup_id as sup_id_1,
		@rpc_repartition as rpc_repartition_1,
		@cont_num as cont_num_1,
		@numero_reception as numero_reception_1*/
	from tf_repart_calcul r
	join tr_categorie_support s on (r.sup_id = s.sup_id)
	where r.rpc_statut = 0
	and r.ate_id = isnull(@ate_id, r.ate_id)
	and r.sem_num = isnull(@sem_num, r.sem_num)
	and r.sem_annee = isnull(@sem_annee, r.sem_annee)
	and r.rpc_annonceur = isnull(@rpc_annonceur, r.rpc_annonceur)
	and r.rpc_theme = isnull(@rpc_theme, r.rpc_theme)
	and r.sup_id = isnull(@sup_id, r.sup_id)
	and r.rpc_repartition = isnull(@rpc_repartition, r.rpc_repartition)
	and r.cont_num = isnull(@cont_num, r.cont_num)
	and isnull(r.numeroReception, 0) = isnull(@numero_reception, isnull(r.numeroReception, 0))
	order by r.rpc_repartition

	-- fin de la procedure
	return 0
end
GO
/****** Object:  StoredProcedure [dbo].[p_s_Repartition]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================
-- Author:		Mahdi Baldé
-- Create date: 22/04/07
-- Description:	Affiche la liste des réparatitions avec une liste de parametres.
--              cette procedure remplacera toute les proc d'acces/recherche a la table tf_repart_calcul
-- =============================================
-- Date			| User			| Description
-- -----------------------------------------------------------------------
-- 12-10-2011	| Wheeler A.	| ajout de l'utilisateur pour prendre 
--				|				| en compte la repartition wissous / nimes
-- -----------------------------------------------------------------------
CREATE PROCEDURE [dbo].[p_s_Repartition]
	@user				varchar(50),
	@sup_id				varchar(20) = null,
	@rpc_repartition	varchar(20) = null
AS
DECLARE @sqlREQ varchar(2000),
        @sqlREQ2 varchar(2000)
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
	declare @ate_id smallint
	
	-- on recupere le site (tr_atelier) de l'utilisateur
	select @ate_id = ate_id
	from tr_utilisateur
	where loginWindows = @user
	
	set @sqlREQ2=''

	if @sup_id = ''
		select @sup_id = null
	if @rpc_repartition =''
		select @rpc_repartition = null

	SELECT distinct CONVERT(varchar, rpc_dat_aff, 103) as date,
		rpc_repartition,
		rpc_rpfo_ident as rpfo_ident,
		rpc_annonceur as annonceur,
		sup_id,
		nom_format = (select sup_nom from tr_categorie_support b where a.sup_id = b.sup_id),
		tpr_id,
		typeprepa = (select tpr_lib from tr_type_preparation b where a.tpr_id = b.tpr_id)
	FROM tf_repart_calcul a
	where rpc_statut in (0,1) 
	and sup_id =isnull(@sup_id,sup_id)
	and rpc_repartition = isnull(@rpc_repartition, rpc_repartition) 
	and ate_id = @ate_id
	order by rpc_repartition
END
GO
/****** Object:  StoredProcedure [dbo].[p_s_tarifs_transporteur]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
create procedure [dbo].[p_s_tarifs_transporteur]
(
	--@loginWindows	varchar(50),
	@tsp_id         int
)
as
begin

--select @loginWindows = upper (@loginWindows)
	-- description : retourne les tarifs pour un transporteurs donné
	--
	-- 2015.06.01	| CLEMENT. P	| Creation
	-- 2015.07.31	| CLEMENT. P	| Posibilité de ramener l'ensemble des tarif si param tsp_id est null

	
SELECT -- Transporteur
       trsp.tsp_id,
       trsp.tsp_nom,
	   trsp.tsp_inactif,
	   trsp.tsp_interne,
	   -- Tarif
	   trtt.tarif_code,
	   trtt.tarif_code_fac_client,
	   trtt.tarif_expediteur,
	   trtt.tarif_incoterm,
	   trtt.tarif_type_edition,
	   trtt.tarif_regroupement

	FROM tr_transporteur trsp
	INNER JOIN tr_trans_tarif trtt ON trsp.tsp_id = trtt.tsp_id
	WHERE (trsp.tsp_id = @tsp_id OR @tsp_id is null)
	
    if @@error <> 0
		return -1
	
	-- fin de la procedure
	return 0
end
GO
/****** Object:  StoredProcedure [dbo].[p_s_th_repart_annule]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE procedure [dbo].[p_s_th_repart_annule]
(
	@repa_ident int = null,
	@cont_num int = null,
	@dateDebut datetime,
	@dateFin datetime
)
as
begin
	-- description : recupere la liste des repartitions qui ont été debloque
	--				par numero de repartition ou numero de contrat ou toutes
	--				si aucun parametre n'est fourni
	-- 
	-- 2013.10.08	| Wheeler A.	| creation
	-- 2017.05.09	| Wheeler A.	| ajout des nouvelles colonnes de la tables et des criteres de dates
	
	-- on retourne la liste des repartition debloquer 
	-- par numero de repartition
	if isnull(@repa_ident, 0) <> 0
	begin
		select repa_ident,
			cont_num,
			typr_lib,
			cont_annonc,
			rpfo_qte_reserv,
			cont_anbas,
			cont_sembas,
			loginWindows,
			date_annulation,
			IdGroupePreparation,
			IdSiteCCF
		from th_repart_annule
		where repa_ident = @repa_ident
		and convert(date, date_annulation) between @dateDebut and @dateFin
		order by repa_ident
	end
	
	-- ou par numero de contrat
	else if isnull(@cont_num, 0) <> 0
	begin
		select repa_ident,
			cont_num,
			typr_lib,
			cont_annonc,
			rpfo_qte_reserv,
			cont_anbas,
			cont_sembas,
			loginWindows,
			date_annulation,
			IdGroupePreparation,
			IdSiteCCF
		from th_repart_annule
		where cont_num = @cont_num
		and convert(date, date_annulation) between @dateDebut and @dateFin
		order by repa_ident
	end
	else
	
	-- ou toutes
	begin
		select repa_ident,
			cont_num,
			typr_lib,
			cont_annonc,
			rpfo_qte_reserv,
			cont_anbas,
			cont_sembas,
			loginWindows,
			date_annulation,
			IdGroupePreparation,
			IdSiteCCF
		from th_repart_annule
		where convert(date, date_annulation) between @dateDebut and @dateFin
		order by repa_ident
	end
	
	if @@ERROR <> 0 goto erreur
	
	-- fin de la procedure
	return 0
	
erreur:
	return -1
end
;
GO
/****** Object:  StoredProcedure [dbo].[p_s_trainDUnColis]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[p_s_trainDUnColis]
(
	@colis_id int
)
AS
begin
	-- description : retourne la liste des trains d'un colis
	-- 
	-- 2016.06.21	| Wheeler A.	| creation

	select t.train_id,
		c.sup_nom,
		t.pers_nom,
		count(*) as nombreFace
	from tf_face_train t
	join tr_categorie_support c on (t.sup_id = c.sup_id)
	where t.colis_id = @colis_id
	group by t.train_id,
		c.sup_nom,
		t.pers_nom

	-- fin de la procedure
	return 0
end
GO
/****** Object:  StoredProcedure [dbo].[p_s_transporteur]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE procedure [dbo].[p_s_transporteur]
(
	@tsp_id         int,
	@user           varchar(30) = NULL
)
as
begin

	-- description : retourne les données du transporteur
	--
	-- 2015.04.07	| CLEMENT. P	| Creation

	
SELECT -- Transporteur
       trsp.tsp_id,
       trsp.tsp_nom,
	   trsp.tsp_inactif,
	   trsp.tsp_interne,
	   -- Tarif
	   trtt.tarif_code,
	   trtt.tarif_code_fac_client,
	   trtt.tarif_expediteur,
	   trtt.tarif_incoterm,
	   trtt.tarif_type_edition,
	   trtt.tarif_regroupement,
	   -- Param Local
	   ISNULL(ate.ate_id, 0) as ate_id,
	   pltf.plt_nom,
	   ate.ate_lib,
	   trspa.tra_code_tiers,
	   trspa.tra_ip,
	   trsp.cle_Api,
	   trsp.id_Api	

	FROM tr_transporteur trsp
	LEFT OUTER JOIN tr_trans_tarif trtt ON trsp.tsp_id = trtt.tsp_id
	LEFT OUTER JOIN tr_transporteur_atelier trspa ON trsp.tsp_id = trspa.tsp_id
	LEFT OUTER JOIN tr_atelier ate ON trspa.ate_id = ate.ate_id 
	LEFT OUTER JOIN tr_plateforme pltf ON ate.plt_id = pltf.plt_id
	WHERE trsp.tsp_id = @tsp_id
	
    if @@error <> 0
		return -1
	
	-- fin de la procedure
	return 0
end
GO
/****** Object:  StoredProcedure [dbo].[p_s_transporteur_atelier]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

create procedure [dbo].[p_s_transporteur_atelier]
	 @user		varchar(50),
	 @tsp_id	t_id_l
AS
BEGIN
-- Role : retourne l'addresse au format UNC ('\\serveur\') pour un transporteur
-- en tenant compte du site (tr_atelier.ate_id)
--
-- Date			| User			| Description
-- -----------------------------------------------------------------------
-- 11-10-2011	| Wheeler A.	| creation
-- -----------------------------------------------------------------------

	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
	-- declaration
	declare @ate_id smallint
	
	-- on recupere le site de l'utilisateur
	select @ate_id = ate_id
	from tr_utilisateur
	where loginWindows = @user	

    -- Insert statements for procedure here
	select rtrim(tra_ip) as tra_ip
	from tr_transporteur_atelier
	where tsp_id = @tsp_id
	and ate_id = @ate_id
	
	-- fin de la procedure
	return 0
END
GO
/****** Object:  StoredProcedure [dbo].[p_s_transporteur_from_colis]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[p_s_transporteur_from_colis] 
(
	@colis_id         int,
	@user            varchar(30)
)    
AS
BEGIN
	-- =============================================================================
	-- Author:		PCL
	-- Create date: 26/06/15
	-- Description:	Recupère les données de transpoteur pour un colis donné
	-- =============================================================================
	-- Date			| User			| Description
	-- -----------------------------------------------------------------------
	-- 26-06-2015	| PCL.	| Création
	-- -----------------------------------------------------------------------

	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	SELECT 
        col.colis_id as colis_id,
		col.colis_code as colis_code,
		col.colis_code_ext as colis_code_ext,
		col.colis_dat_expe as colis_dat_expe,
		col.rpc_statut as rpc_statut,
		col.tarif_code as tarif_code,
		--col.tsp_id as tsp_id,
		sta.statut_nom as statut_nom, 
		ISNULL(trsp.tsp_id,0) as tsp_id,
		trsp.tsp_nom as tsp_nom,
		trsp.tsp_inactif as tsp_inactif,
		trsp.tsp_interne as tsp_interne,
		ISNULL(col.dest_id,0) as dest_id

	FROM tf_colis col
	LEFT JOIN tr_ate_dest_trans ateDesTrans ON (col.tsp_id = ateDesTrans.tsp_id AND col.tarif_code = ateDesTrans.tarif_code)
	LEFT JOIN tr_transporteur trsp ON col.tsp_id = trsp.tsp_id
	INNER JOIN tr_statut sta ON sta.rpc_statut = col.rpc_statut
	WHERE col.colis_id = @colis_id 
    
	-- fin de la procedure
	return 0
END
GO
/****** Object:  StoredProcedure [dbo].[p_s_transporteur_from_destinataire]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================================================
-- Author:		PCL
-- Create date: 16/06/15
-- Description:	Recupère les données de transpoteur pour un destinataire donnée
-- =============================================================================
-- Date			| User			| Description
-- -----------------------------------------------------------------------
-- 16-06-2015	| PCL.	| Création
-- 22-06-2015	| SJA.	| Maj
-- -----------------------------------------------------------------------
CREATE PROCEDURE [dbo].[p_s_transporteur_from_destinataire] 
(
	@dest_id         int,
	@user            varchar(30)
)    
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

 
       SELECT 
        dest.dest_id as dest_id,
		dest.dest_nom as dest_nom,
		trsp.tsp_id as tsp_id,
		trsp.tsp_nom as tsp_nom,
		ate.ate_id as ate_id,
		ate.ate_lib as ate_lib,
		plt.plt_nom as plt_nom,
		-- Tarif
	   trtt.tarif_code
	FROM tr_destinataire dest, tr_transporteur trsp ,tr_ate_dest_trans ateDesTrans, 
    tr_atelier ate,tr_trans_tarif trtt ,   tr_plateforme plt 
    where 
        trsp.tsp_id = trtt.tsp_id 
        and ateDesTrans.tsp_id = trsp.tsp_id
       and dest.dest_id = ateDesTrans.dest_id
       and ateDesTrans.tarif_code = trtt.tarif_code
        and ateDesTrans.ate_id = ate.ate_id
        and ate.plt_id = plt.plt_id
        and dest.dest_id = @dest_id 
    
	-- fin de la procedure
	return 0
END
;
GO
/****** Object:  StoredProcedure [dbo].[p_s_type_destination]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
create procedure [dbo].[p_s_type_destination]

as
begin

-- description : retourne le type de destination
----------------------------------------------------------------------------
-- 2015.09.08	| CLEMENT. P	| Creation
----------------------------------------------------------------------------
	
    SELECT [des_type]
          ,[type_nom]
    FROM [tr_type_destination]
	
    if @@error <> 0
		return -1
	
	-- fin de la procedure
	return 0
end
GO
/****** Object:  StoredProcedure [dbo].[p_s_type_preparation]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE procedure [dbo].[p_s_type_preparation]

as
begin

	-- description : retourne le type de préparation
	----------------------------------------------------------------------------
	-- 2015.06.25	| CLEMENT. P	| Creation
	----------------------------------------------------------------------------
	
    SELECT [tpr_id]   as tpr_id
          ,[tpr_lib]  as tpr_lib
          ,[tpr_user] as tpr_user
	FROM tr_type_preparation
	WHERE tpr_id in (2,10,12)
	
    if @@error <> 0
		return -1
	
	-- fin de la procedure
	return 0
end
GO
/****** Object:  StoredProcedure [dbo].[p_s_UM_from_code]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================
-- Author:		SJA
-- Create date: 12/04/07
-- Description:	recherche le destintataire à partir d'un code barre
-- =============================================
-- Date			| User			| Description
-- ------------------------------------------------------------------------------------------------
-- 09-04-2015	| PCL.	| Prise en compte code barre synthese et détail + colis_id + calcul uc_qte
-- 09-02-2015	| SJA.	| Création
-- ------------------------------------------------------------------------------------------------
CREATE PROCEDURE [dbo].[p_s_UM_from_code] 
	@code			varchar(20),
	@um_id			    int
    
       
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	SET FMTONLY OFF;

	SELECT @um_id = ISNULL(@um_id, 0);
	SELECT @code  = ISNULL(@code, '');

	IF (SELECT COUNT(1) FROM tf_UM WHERE tf_UM.UM_id = @um_id) > 0
	BEGIN
	SELECT
	um.UM_id             as UM_id,
	um.rpc_statut        as rpc_statut,
	ISNULL(umColis.colis_id, 0) as colis_id,
    UM_code_barre        as UM_code_barre,
	UM_code_synthese     as UM_code_synthese,
    um.sup_id            as sup_id,
    um.tpr_id            as tpr_id, 
    cont_num             as cont_num,
    UM_theme             as UM_theme,
    UM_qte               as UM_qte,
    ISNULL(umColis.uc_qte, UM_qte) as uc_qte,    
	dest.dest_id as dest_id ,
	dest.dest_nom as dest_nom,
	ate.ate_id  as ate_id,
	ate.ate_lib as ate_lib,
	sup_nom + ' ' + tpr_lib  as format_prepa
	FROM tf_UM um
	INNER JOIN tr_destinataire dest on um.dest_id = dest.dest_id
	INNER JOIN tr_atelier ate on um.ate_id = ate.ate_id
	INNER JOIN tr_categorie_support on (um.sup_id = tr_categorie_support.sup_id)
    INNER JOIN tr_type_preparation on (um.tpr_id = tr_type_preparation.tpr_id)
	LEFT OUTER JOIN tf_UM_colis umColis on (um.UM_id = umColis.UM_id)
	WHERE um.UM_id = @um_id
	RETURN 0
	END

	IF (SELECT COUNT(1) FROM tf_UM WHERE tf_UM.UM_code_synthese = @code) > 0
	BEGIN
	SELECT
	um.UM_id             as UM_id,
	um.rpc_statut        as rpc_statut,
	ISNULL(umColis.colis_id, 0) as colis_id,
    UM_code_barre        as UM_code_barre,
	UM_code_synthese     as UM_code_synthese,
    um.sup_id            as sup_id,
    um.tpr_id            as tpr_id, 
    cont_num             as cont_num,
    UM_theme             as UM_theme,
    UM_qte               as UM_qte,
    ISNULL(umColis.uc_qte, UM_qte) as uc_qte,    
	dest.dest_id as dest_id ,
	dest.dest_nom as dest_nom,
	ate.ate_id  as ate_id,
	ate.ate_lib as ate_lib,
	sup_nom + ' ' + tpr_lib  as format_prepa
	FROM tf_UM um
	INNER JOIN tr_destinataire dest on um.dest_id = dest.dest_id
	INNER JOIN tr_atelier ate on um.ate_id = ate.ate_id
	INNER JOIN tr_categorie_support on (um.sup_id = tr_categorie_support.sup_id)
    INNER JOIN tr_type_preparation on (um.tpr_id = tr_type_preparation.tpr_id)
	LEFT OUTER JOIN tf_UM_colis umColis on (um.UM_id = umColis.UM_id)
	WHERE um.UM_code_synthese = @code
	RETURN 0
	END
    
	SELECT
	um.UM_id             as UM_id,
	um.rpc_statut        as rpc_statut,
	ISNULL(umColis.colis_id, 0) as colis_id,
    UM_code_barre        as UM_code_barre,
	UM_code_synthese     as UM_code_synthese,
    um.sup_id            as sup_id,
    um.tpr_id            as tpr_id, 
    cont_num             as cont_num,
    UM_theme             as UM_theme,
    UM_qte               as UM_qte,
    ISNULL(umColis.uc_qte, UM_qte) as uc_qte,    
	dest.dest_id as dest_id ,
	dest.dest_nom as dest_nom,
	ate.ate_id  as ate_id,
	ate.ate_lib as ate_lib,
	sup_nom + ' ' + tpr_lib  as format_prepa
	FROM tf_UM um
	INNER JOIN tr_destinataire dest on um.dest_id = dest.dest_id
	INNER JOIN tr_atelier ate on um.ate_id = ate.ate_id
	INNER JOIN tr_categorie_support on (um.sup_id = tr_categorie_support.sup_id)
    INNER JOIN tr_type_preparation on (um.tpr_id = tr_type_preparation.tpr_id)
	LEFT OUTER JOIN tf_UM_colis umColis on (um.UM_id = umColis.UM_id)
	WHERE um.UM_code_barre = @code

	-- fin de la procedure
	return 0
END
GO
/****** Object:  StoredProcedure [dbo].[p_s_UM_from_Colis]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================
-- Author:		SJA
-- Create date: 09/02/2015
-- Description:	recherche le colis end cours à partir destinaire
-- =============================================
-- Date			| User			| Description
-- -----------------------------------------------------------------------
-- 30-03-2015	| PCL.	| Ajout du UM_code_synthese
-- 09-02-2015	| SJA.	| Création
-- -----------------------------------------------------------------------

CREATE PROCEDURE [dbo].[p_s_UM_from_Colis] 
	@colis_id			    int
    
    
       
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	SET FMTONLY OFF;
    
   
  
   select     
   tf_UM_colis.UM_id        as UM_id,
   UM_code_barre            as UM_code_barre,
   UM_code_synthese         as UM_code_synthese,
   tf_UM.sup_id             as sup_id,
   tf_UM.tpr_id             as tpr_id, 
   sup_nom + ' ' + tpr_lib  as format_prepa,
   cont_num                 as cont_num,
   UM_theme                 as UM_theme,
   tf_UM.UM_Repiquage       as UM_repiquage,
   convert (int,null)       as nb_colis,
   UM_qte                   as UM_qte,
   uc_qte                   as uc_qte,
   UM_qte - uc_qte          as restant,
   tf_UM.rpc_statut         as rpc_statut,
   tf_UM.UM_annonceur       as annonceur
   into #t
   from tf_UM_colis 
   join tf_UM on (tf_UM.UM_id = tf_UM_colis.UM_id)
   join tr_categorie_support on (tf_UM.sup_id = tr_categorie_support.sup_id)
   join tr_type_preparation on (tf_UM.tpr_id = tr_type_preparation.tpr_id)
   join tf_colis on tf_colis.colis_id = tf_UM_colis.colis_id
   where tf_UM_colis.colis_id = @colis_id
   order by tf_UM_colis.uc_dat_cre desc
   
   update #t
   set nb_colis = (select count(colis_id) from tf_UM_colis where tf_UM_colis.UM_id = #t.UM_id)
   from  #t
  
    select 
   UM_id as UM_id,
   UM_code_barre as UM_code_barre,
   UM_code_synthese as UM_code_synthese,
   sup_id as sup_id,
   tpr_id as tpr_id, 
   format_prepa as format_prepa,
   cont_num as cont_num,
   UM_theme as UM_theme,
   UM_repiquage as UM_repiquage,
   nb_colis as nb_colis,
   UM_qte as UM_qte,
   uc_qte as uc_qte,
   restant as restant,
   rpc_statut as rpc_statut,
   annonceur  as annonceur
   from #t


-- fin de la procedure
return 0

END
;
GO
/****** Object:  StoredProcedure [dbo].[p_u_associe_train]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE procedure [dbo].[p_u_associe_train]
(
       @instr_code  varchar(18),
    @user       varchar(50)
)
as
begin
       -- description : Procedure qui affecte les visuels et les bandeaux des instructions de train 
       --           dans chaque train + -- creation train et version de train
       -- -----------------------------------------------------
       -- 2015.11.18 | Jaoen S.   | creation
       -- 2016.03.15 | Jaoen S.   | Calcul des entretiens : pb arrondi
       -- 2016.04.05 | Jaoen S.   | Calcul des entretiens : modif code train
    -- 2016.05.27   | Jaoen S.    | ajout d'une position de train IT 36017
       -- 2016.12.02 | Wheeler A.| ajout controle de doublon de face sur les trains.
       -- 2016.12.09 | Wheeler A.| it 39880 : correction option de theme debut de train
       --                        |                   |      ajout des dates et user de mise � jour
       -- 2017.01.16 | Wheeler A.| it 41013 : ajout controle doublon afficheur pour un train
    

       declare @code               tinyint,
                    @log_module                varchar(50),
                    @tip_ins_code       tinyint, 
                    @instr_entretien    tinyint ,
                    @nb_total           int,
                    @nb                 int,
                    @ft_id              int,
                    @insv_id            int,
                    @theme_id           int,
                    @dest_id            int,
                    @combien            int,
                    @insv_theme         varchar(50),
                    @type               varchar (15),
                    @empl_sect_code     smallint, 
                    @dep_sembas         tinyint, 
                    @dep_anbas          smallint,
                    @train              varchar (18),
                    @ate_id             smallint,
                    @theme              varchar(50),
                    @sup_id             smallint,
                    @cont_num           int,
                    @rese_ident         int,
                    @annonceur          varchar(30),
                    @typr_code          tinyint,
                    @i                  int,
                    @cpt_entretien      int,
                    @compteur           int,
                    @repiquage          varchar(50),
                    @cadr_ident                numeric(9,2),
                    @train_id                 varchar(20),
                    @getdate                  datetime,
                    @pers_ident                numeric(9,2),
                    @pers_nom                 varchar(50),
                    @RefConvention      varchar(50)
        
       -- initialisation
       select @log_module = OBJECT_NAME(@@PROCID),
             @getdate = getdate()

       select @code = rpc_statut 
       from instruction_train 
       where instr_code = @instr_code

       /*
       select instr_code, tip_ins_code, instr_entretien
       into
       #t_instruction
       from instruction_train
       where rpc_statut = 1
       and instr_code = @instr_code
       */
       select  @tip_ins_code      =  tip_ins_code, 
                    @instr_entretien = instr_entretien,
                    @ate_id   = ate_id,
                    @annonceur = instr_annonceur,
                    @cont_num = cont_num,
                    @rese_ident = rese_ident
       from instruction_train
       where instr_code = @instr_code

       select insv_id,
             instr_code, 
             sup_id, 
             tpr_id, 
             insv_afch_ident, 
             insv_pourcentage, 
             insv_theme,
             convert ( numeric (5,2),null) as 'frequence',
             convert ( int,null) as 'nb_tot',
             convert ( numeric (10,5),null) as 'encours',
             convert ( int,null) as 'nb_restant',
             convert ( int,null) as 'nb_affecte'
       into #t_visuels
       from instruction_visuels
       where instr_code = @instr_code
       and tpr_id = 10
       --and rpc_statut = 2
       -- Les scro

       select insd_id          ,
             instr_code           ,
             insd_cadr_ident      ,
             sup_id               ,
             tpr_id               ,
             insd_afch_ident      ,
             insd_theme           ,
             insd_repiquage_ident ,
             insd_repiquage       ,
             insd_type                
       into #t_detail
       from instruction_detail
       where instr_code = @instr_code

       select * 
       into #face 
       from tf_face_train
       where instr_code = @instr_code

       --select * from  #t_visuels
       --select * from  #t_detail
       --select * from  #face
       --select * from  #face
       --2    Instructions ok
       --return 0
       
       select @code

       if @code = 2
       begin
             select 'instruction ok - generer les association de visuels !'   
    
             -- position de train
             update #face set ordre_propose = rang
    
             -- gestion des priorite d'ordre de train
             -- 1   debut de train         
             -- 2   fin de train    
             update #face set ordre_reel = 0
             where @tip_ins_code = 1
    
             update #face set ordre_reel = 99
             where @tip_ins_code = 2

             -- SJA 36017
             --fin -1 : Dernier sauf si fin de train.
             update #face set ordre_reel = 98
             where @tip_ins_code = 3


             -- OJE 
             --milieu  : milieu de train
             update #face set ordre_reel = 15
             where @tip_ins_code = 4
    
             -- update #face set ordre_reel = ordre_propose where ordre_reel = 0

             update #face set ordre_reel = ordre_propose where ordre_reel is null
    
             -- recherce de la version de train
             -- version = derniere version (max) des trains deja avances (statut 5 a 10) sur le meme
             -- emplacement / train / semaine + 1
             -- optimisation : on ne lit que la ou les semaines des faces de l'instruction (index
             -- tf_face_train_semann) puis on calcule le max par groupe une seule fois, au lieu de
             -- parcourir tf_face_train (14 M de lignes, pas d'index sur empl_ident) pour chaque face
             select distinct dep_sembas, dep_anbas
             into #semaine_face
             from #face

             select t.empl_ident, t.train, t.dep_sembas, t.dep_anbas, max (t.version) as version_max
             into #version_train
             from tf_face_train t
             join #semaine_face s on (s.dep_sembas = t.dep_sembas and s.dep_anbas = t.dep_anbas)
             where t.rpc_statut in (5, 6, 7, 8, 9, 10)
             group by t.empl_ident, t.train, t.dep_sembas, t.dep_anbas

             -- version_max null (aucune version renseignee) : pas de mise a jour, comme avant
             update #face
             set version = v.version_max + 1
             from #face
             join #version_train v on (v.empl_ident = #face.empl_ident
                                       and v.train = #face.train
                                       and v.dep_sembas = #face.dep_sembas
                                       and v.dep_anbas = #face.dep_anbas)
             where v.version_max is not null

             drop table #semaine_face
             drop table #version_train

       
             update #face set version = 0 where version is null   

             select @type = 'exception'

             -- Association des exception a la face : theme
             update #face
             set #face.theme =  #t_detail.insd_theme,
                    #face.theme_id =  #t_detail.insd_afch_ident,
                    ft_type = @type 
             from #face, #t_detail
             where #face.instr_code = #t_detail.instr_code
             and #face.cadr_ident = #t_detail.insd_cadr_ident
             and #t_detail.insd_theme is not null
    
             -- Association des exception a la face : repiquages
             update #face
             set #face.repiquage =  #t_detail.insd_repiquage,
                    #face.repiquage_id =  #t_detail.insd_repiquage_ident
             from #face, #t_detail
             where #face.instr_code = #t_detail.instr_code
             and #face.cadr_ident = #t_detail.insd_cadr_ident
             and #t_detail.insd_repiquage is not null

             -- on recroise avec le visuel
             update #face 
             set #face.insv_id = instruction_visuels.insv_id 
             from #face, instruction_visuels
             where #face.theme_id = instruction_visuels.insv_afch_ident

             -- Association des faces !
    
             -- initialisation
             select @nb_total = count (*) from #face

             update #t_visuels
             set frequence =  convert ( numeric (5,2),insv_pourcentage/100), 
             encours =  convert ( numeric (10,5),insv_pourcentage/100)
    
             update #t_visuels set nb_tot = convert (int, frequence * @nb_total)
             update #t_visuels set nb_restant = 0
   
             --   'frequence' :  theorique attendu
             --   'encours' : affectation encours
             --   'nb_tot' : total attendu
             --   'nb_restant' : restant a affecter
    
             --convert ( numeric (5,2),null) as 'nb_encours',
             --convert ( numeric (5,2),null) as 'nb_tot'
             update #t_visuels 
             set nb_restant = nb_tot - ( select count( cadr_ident) 
             from #face, #t_visuels 
             where #t_visuels.insv_afch_ident  =  #face.theme_id )


             --    select distinct insv_afch_ident   from #t_visuels 
             --select distinct theme_id from #face
             /*    update #t_visuels set nb_affecte = count (cadr_ident) 
                    from #face, #t_visuels 
                    where #t_visuels.insv_afch_ident  =  #face.theme_id
                    group by #face.theme_id
             */

             UPDATE #t_visuels
             SET nb_affecte = ( SELECT count(a.cadr_ident) 
                                              FROM  #face a 
                                              INNER JOIN #t_visuels c ON ( c.insv_afch_ident = a.theme_id ) 
                                              WHERE #t_visuels.insv_afch_ident = a.theme_id 
                                              GROUP BY a.theme_id )

             update #t_visuels set nb_affecte = 0 where nb_affecte is null
             update #t_visuels set nb_restant = nb_tot - nb_affecte


             select @nb = count (*) from #face where theme_id is null
             --    select * from #t_visuels
    
        
             if @nb <> 0
             begin
                    update #t_visuels set encours = convert ( numeric (10,5),nb_restant/@nb)
                    where @nb <>0
        
                    --select * from #t_visuels
        
                    select @type = 'face'
                    --select * from #t_visuels
                    --select  'nb',@nb      
                    select @i  = 1
        
                    declare C1 cursor for 
                    select ft_id from #face 
                    where theme_id  is null
                    order by empl_sect_code,empl_depa_code, comm_numord, empl_addresse1
        
                    for update of insv_id,theme, theme_id,repiquage, repiquage_id , ft_type 
        
                    open C1
                    fetch next FROM C1 into @ft_id
    
                    while @@fetch_status = 0
                    begin
                          ---select @insv_id =  max (insv_id) from #t_visuels
                          --where #t_visuels.nb_restant = (select max (t2.nb_restant) from #t_visuels t2)
                 
                          select @insv_id =  max (insv_id)
                          from #t_visuels
                          where #t_visuels.encours <= convert (numeric(10,5) ,frequence)
                          and nb_restant > 0
        
                          if @insv_id is  null
                                 select @insv_id = min(insv_id) from #t_visuels  
        
                          -- Affectation du theme
                          update #face
                          set #face.theme =  #t_visuels.insv_theme,
                                 #face.theme_id = #t_visuels.insv_afch_ident,
                                 #face.insv_id = @insv_id,
                                 ft_type = @type 
                          from #t_visuels
                          where #face.ft_id= @ft_id
                          and  #t_visuels.insv_id = @insv_id
    
                          select @nb = @nb -1
                          update #t_visuels
                          set nb_restant = nb_restant-1, nb_affecte = nb_affecte +1
                          where #t_visuels.insv_id = @insv_id
              
                          /* update #t_visuels set encours = convert ( numeric (8,2),convert (numeric(8,2),nb_affecte)/convert (numeric(8,2),@i))
                          where @i <> 0*/
       
                          -- select @compteur = Sum select (nb_affecte) from #t_visuels group by instr_code
                          select @compteur = Sum (nb_affecte) from #t_visuels group by instr_code
       
                          update #t_visuels
                          set encours = convert ( numeric (10,5),convert (numeric(10,5),nb_affecte)/convert (numeric(10,5),@compteur))
                          where @compteur <> 0
         
                          select @i = @i+1
            
                          fetch next FROM C1 into @ft_id
                    END --while fetch
                    CLOSE C1
                    DEALLOCATE C1
             end
    
    
             -- gestion des bandeaux a 100% non geres end exception
             update #face
             set #face.repiquage =  instruction_visuels.insv_theme,
                    #face.repiquage_id = instruction_visuels.insv_afch_ident
             from instruction_visuels
             where #face.instr_code = instruction_visuels.instr_code
             and  instruction_visuels.tpr_id = 2
             and  instruction_visuels.insv_pourcentage = 100
             and instruction_visuels.instr_code = @instr_code
             and #face.repiquage is null
        
             /*
             [Semaine] : 2 positions
             [Annee] : 2 positions
             [Section patrimoine] : 3 positions
             [Departement] : 2 positions
             [commune] : 3 postions
             [Emplacement] : 4 positions
             [Numero train emplacement] : 1 position
             Version train : 1 position
             */

             -- SJA pb des caract�res sp�ciaux 
             update #face
             set theme = isnull (theme,'')+'---' 
             where len (theme) < 3

             update #face
             set theme = replace ( theme, '''',' ')
             update #face
             set theme = replace ( theme, '"',' ')
   
             update #face
             set repiquage = replace ( repiquage, '"',' ')
             update #face
             set repiquage = replace ( repiquage, '''',' ')


             select @annonceur = replace ( @annonceur, '"',' ')
             select @annonceur = replace ( @annonceur, '''',' ')

             update #face  
             set train_id = right ('00'+ convert (varchar (4),dep_anbas),2)+
                    right ('00'+ convert (varchar (2),dep_sembas),2)+
                    right ('000'+ convert (varchar (3),empl_sect_code),3)+
                    right ('00'+ convert (varchar (2),empl_depa_code),2)+
                    right ('000'+ convert (varchar (3),comm_numord),3)+
                    right ('0000'+ convert (varchar (4),empl_numord),4)+
                    convert (varchar (1), train)+
                    convert (varchar (1), version)

             -- mise a jour finale.
             update tf_face_train
             set tf_face_train.theme =  #face.theme,
                    tf_face_train.theme_id =  #face.theme_id,
                    tf_face_train.repiquage =  #face.repiquage,
                    tf_face_train.repiquage_id =  #face.repiquage_id,
                    tf_face_train.insv_id = #face.insv_id,
                    tf_face_train.rpc_statut = 2,
                    tf_face_train.ft_type = #face.ft_type,
                    tf_face_train.train_id = #face.train_id,
                    tf_face_train.version = #face.version,
                    tf_face_train.ordre_propose = #face.ordre_propose,
                    tf_face_train.ordre_reel = #face.ordre_reel,
                    tf_face_train.cont_annonc = @annonceur,
                    ft_dat_maj = @getdate,
                    ft_user_maj = @user
             from tf_face_train, #face 
             where #face.ft_id= tf_face_train.ft_id
             and #face.ft_type <> 'entretien'
    
             -- gestion des entretiens
  
             --select * from #face
             --return 0
  
             select @type = 'entretien'    

             create table #entretien(nb int null, dest_id int null, theme_id int null, empl_sect_code int null,dep_sembas int null, dep_anbas int null, theme varchar(50) null, sup_id int null, typr_code int null,RefConvention varchar(50) null)
    
       insert into #entretien(nb , dest_id , theme_id , empl_sect_code ,dep_sembas , dep_anbas , theme , sup_id , typr_code ,RefConvention)

             -- entretien autre que paris 
             select count (distinct ft_id) 'nb',
                    dest_id, 
                    theme_id, 
                    empl_sect_code, 
                    dep_sembas, 
                    dep_anbas,
                    convert ( varchar(50), isnull (repiquage + '#','')+theme) as theme,
                    sup_id,
                    typr_code ,
                    null 
             from #face
             where ISNULL(RefConvention,'') != 'VPS_75 101 0004' 
             group by dest_id,theme_id, 
                    empl_sect_code, 
                    dep_sembas, 
                    dep_anbas,
                    convert ( varchar(50), isnull (repiquage + '#','')+theme) ,
                    --theme,
                    sup_id    ,
                    typr_code 
					   
             select @instr_entretien = 8 where @instr_entretien is null

             update #entretien 
             set nb = convert (int, round ( convert (decimal ,nb * @instr_entretien) / 100.0,0))
    
             declare C2 cursor for
             select nb, dest_id, theme_id, empl_sect_code, dep_sembas, dep_anbas, theme, sup_id, typr_code , RefConvention
             from #entretien 
             where nb > 0 
        
             select @repiquage = null
        
             open C2
             fetch next FROM C2 into @combien, @dest_id, @theme_id , 
                    @empl_sect_code,@dep_sembas,@dep_anbas,@theme,@sup_id,@typr_code , @RefConvention
    
             while @@fetch_status = 0
             begin
                    -- SJA repiquage sur entretien
                    select @repiquage = left ( @theme,charindex ('#',@theme)-1)
                    where charindex ('#',@theme) > 0
        
                    select @theme = right ( @theme,len (@theme)-charindex ('#',@theme))
                    where charindex ('#',@theme) >0

                    -- optimisation : comptage fait une seule fois avant la boucle (il etait refait a chaque
                    -- entretien insere). Chaque insertion ci-dessous ajoute exactement une ligne 'entretien'
                    -- sur la meme semaine / secteur, d'ou le +1 a chaque tour : meme numerotation qu'avant
                    select @cpt_entretien = count(*)
                    from tf_face_train
                    where dep_sembas = @dep_sembas
                    and   dep_anbas = @dep_anbas
                    and   empl_sect_code = @empl_sect_code
                    and    cadre_lib ='entretien'

                    while @combien > 0
                    begin
                          -- equivalence stricte avec l'ancienne version : si une cle est nulle, le count
                          -- (= null) renvoyait 0 a chaque tour, donc tous les entretiens prenaient le n 1
                          if @empl_sect_code is null or @dep_sembas is null or @dep_anbas is null
                                 select @cpt_entretien = 0

                          select @cpt_entretien = @cpt_entretien + 1
                          -- select 'entretien', @combien                 
                          select @train = right ('00'+ convert (varchar (4),@dep_anbas),2)+
                                 right ('00'+ convert (varchar (4),@dep_sembas),2)+
                                 right ('000'+ convert (varchar (3),@empl_sect_code),3)+
                                 right ('0'+ convert (varchar (2),@ate_id),1)+
                                 right ('00'+ convert (varchar (8),isnull(@cont_num,0)),2)+
                                 right ('000000' + convert (varchar,@cpt_entretien),6) + '19'
                    --right ('EE'+ convert (varchar (8),isnull(@cont_num,0)),2)+
                                 --right ('EEEEEE' + convert (varchar,@cpt_entretien),6) + '19'
                                 -- right ('0000'+ convert (varchar (4),@dest_id),4)+ '11'
              
                          --select 'entretien2', @combien  ,@train       
                          insert into tf_face_train (train_id, 
                                 version, 
                                 ft_type, 
                                 dest_id, 
                                 theme_id , 
                                 empl_sect_code,
                                 dep_sembas,
                                 dep_anbas, 
                                 instr_code,
                                 rpc_statut,
                                 ate_id ,
                                 theme,
                                 ft_dat_cre,
                                 ft_user_maj,
                                 cadre_lib,
                                 cadr_ident,
                                 rdep_datdep,
                                 sup_id,
                                 cont_num, 
                                 rese_ident ,
                                 idre_nom ,
                                 cont_annonc,
                                 typr_code,
                                 ordre_propose,
                                 ordre_reel,
                                 pers_ident,
                                 pers_nom,
                                 cont_sembas,
                                 cont_anbas,
                                 repiquage,
                                 RefConvention
                          ) 
                          values (@train,
                                 1,
                                 @type,
                                 @dest_id, 
                                 @theme_id , 
                                 @empl_sect_code,
                                 @dep_sembas,
                                 @dep_anbas, 
                                 @instr_code,
                                 2,
                                 @ate_id ,
                                 @theme ,
                                 @getdate,
                                 @user,
                                 @type,
                                 0,
                                 convert (smalldatetime, @getdate),
                                 @sup_id,
                                 @cont_num, 
                                 @rese_ident ,
                                 @annonceur  ,
                                 @annonceur  ,
                                 @typr_code,
                                 1,
                                 1,
                                 0,
                                 'ENTRETIEN',
                                 @dep_sembas,
                                 @dep_anbas,
                                 @repiquage,
                                 @RefConvention)
              
                          select @combien  = @combien - 1   
                    end 
                
                    select @repiquage = null
        
                    fetch next FROM C2 into @combien, @dest_id, @theme_id , 
                           @empl_sect_code,@dep_sembas,@dep_anbas,@theme,@sup_id, @typr_code, @RefConvention
             end
        
             CLOSE C2
             DEALLOCATE C2


			 delete from #entretien

                    -- entretien paris 
       insert into #entretien(nb , dest_id , theme_id , empl_sect_code ,dep_sembas , dep_anbas , theme , sup_id , typr_code ,RefConvention)
             select count (distinct ft_id) 'nb',
                    dest_id, 
                    theme_id, 
                    empl_sect_code, 
                    dep_sembas, 
                    dep_anbas,
                    convert ( varchar(50), isnull (repiquage + '#','')+theme) as theme,
                    sup_id,
                    typr_code ,
                    'VPS_75 101 0004' 
             from #face
             where RefConvention = 'VPS_75 101 0004'
             group by dest_id,theme_id, 
                    empl_sect_code, 
                    dep_sembas, 
                    dep_anbas,
                    convert ( varchar(50), isnull (repiquage + '#','')+theme) ,
                    --theme,
                    sup_id    ,
                    typr_code 

					select @instr_entretien = 8 where @instr_entretien is null

             update #entretien 
             set nb = convert (int, round ( convert (decimal ,nb * @instr_entretien) / 100.0,0))
    
             declare C2 cursor for
             select nb, dest_id, theme_id, empl_sect_code, dep_sembas, dep_anbas, theme, sup_id, typr_code , RefConvention
             from #entretien 
             where nb > 0 
        
             select @repiquage = null
        
             open C2
             fetch next FROM C2 into @combien, @dest_id, @theme_id , 
                    @empl_sect_code,@dep_sembas,@dep_anbas,@theme,@sup_id,@typr_code , @RefConvention
    
             while @@fetch_status = 0
             begin
                    -- SJA repiquage sur entretien
                    select @repiquage = left ( @theme,charindex ('#',@theme)-1)
                    where charindex ('#',@theme) > 0
        
                    select @theme = right ( @theme,len (@theme)-charindex ('#',@theme))
                    where charindex ('#',@theme) >0

                    -- optimisation : comptage fait une seule fois avant la boucle (il etait refait a chaque
                    -- entretien insere). Chaque insertion ci-dessous ajoute exactement une ligne 'entretien'
                    -- sur la meme semaine / secteur, d'ou le +1 a chaque tour : meme numerotation qu'avant
                    select @cpt_entretien = count(*)
                    from tf_face_train
                    where dep_sembas = @dep_sembas
                    and   dep_anbas = @dep_anbas
                    and   empl_sect_code = @empl_sect_code
                    and    cadre_lib ='entretien'

                    while @combien > 0
                    begin
                          -- equivalence stricte avec l'ancienne version : si une cle est nulle, le count
                          -- (= null) renvoyait 0 a chaque tour, donc tous les entretiens prenaient le n 1
                          if @empl_sect_code is null or @dep_sembas is null or @dep_anbas is null
                                 select @cpt_entretien = 0

                          select @cpt_entretien = @cpt_entretien + 1
                          -- select 'entretien', @combien                 
                          select @train = right ('00'+ convert (varchar (4),@dep_anbas),2)+
                                 right ('00'+ convert (varchar (4),@dep_sembas),2)+
                                 right ('000'+ convert (varchar (3),@empl_sect_code),3)+
                                 right ('0'+ convert (varchar (2),@ate_id),1)+
                                 right ('00'+ convert (varchar (8),isnull(@cont_num,0)),2)+
                                 right ('000000' + convert (varchar,@cpt_entretien),6) + '19'
                    --right ('EE'+ convert (varchar (8),isnull(@cont_num,0)),2)+
                                 --right ('EEEEEE' + convert (varchar,@cpt_entretien),6) + '19'
                                 -- right ('0000'+ convert (varchar (4),@dest_id),4)+ '11'
              
                          --select 'entretien2', @combien  ,@train       
                          insert into tf_face_train (train_id, 
                                 version, 
                                 ft_type, 
                                 dest_id, 
                                 theme_id , 
                                 empl_sect_code,
                                 dep_sembas,
                                 dep_anbas, 
                                 instr_code,
                                 rpc_statut,
                                 ate_id ,
                                 theme,
                                 ft_dat_cre,
                                 ft_user_maj,
                                 cadre_lib,
                                 cadr_ident,
                                 rdep_datdep,
                                 sup_id,
                                 cont_num, 
                                 rese_ident ,
                                 idre_nom ,
                                 cont_annonc,
                                 typr_code,
                                 ordre_propose,
                                 ordre_reel,
                                 pers_ident,
                                 pers_nom,
                                 cont_sembas,
                                 cont_anbas,
                                 repiquage,
                                 RefConvention
                          ) 
                          values (@train,
                                 1,
                                 @type,
                                 @dest_id, 
                                 @theme_id , 
                                 @empl_sect_code,
                                 @dep_sembas,
                                 @dep_anbas, 
                                 @instr_code,
                                 2,
                                 @ate_id ,
                                 @theme ,
                                 @getdate,
                                 @user,
                                 @type,
                                 0,
                                 convert (smalldatetime, @getdate),
                                 @sup_id,
                                 @cont_num, 
                                 @rese_ident ,
                                 @annonceur  ,
                                 @annonceur  ,
                                 @typr_code,
                                 1,
                                 1,
                                 0,
                                 'ENTRETIEN',
                                 @dep_sembas,
                                 @dep_anbas,
                                 @repiquage,
                                 @RefConvention)
              
                          select @combien  = @combien - 1   
                    end 
                
                    select @repiquage = null
        
                    fetch next FROM C2 into @combien, @dest_id, @theme_id , 
                           @empl_sect_code,@dep_sembas,@dep_anbas,@theme,@sup_id, @typr_code, @RefConvention
             end
        
             CLOSE C2
             DEALLOCATE C2


        
             -- g�n�re des anomalies
             -- optimisation : limite a l'instruction traitee (index tf_face_train_instr_code). Les faces
             -- au statut 2 sans train ne peuvent venir que de la mise a jour finale ci-dessus ; la version
             -- globale parcourait les 14 M de lignes a chaque appel (0 ligne concernee en PROD au 08/10/2026)
             delete from tf_face_train where instr_code = @instr_code and train_id is null and rpc_statut = 2

             --select * from  #t_visuels
             --select * from  #t_detail
             --select * from  #entretien
             --select * from  #face

             -- controle pour les doublons sur les faces
             -- pour chaque train, s'il y a un doublon sur les faces (cadr_ident)
             -- on prend la ligne la plus recente en terme de creation

             -- on recupere la liste des doublons
             select f2.train_id, f2.cadr_ident
             into #doublon
             from tf_face_train f1
             join tf_face_train f2 on (f1.train_id = f2.train_id)
             where f1.instr_code = @instr_code
             and f2.train_id is not null
             and f2.ft_type <> 'entretien'
             group by f2.train_id, f2.cadr_ident
             having count(*) > 1

             if (@@rowcount > 0)
             begin
                    -- pour chaque train
                    while (1=1)
                    begin
                          select top 1 @train_id = train_id
                          from #doublon

                          if @@rowcount = 0
                          begin
                                 break
                          end

                          -- pour chaque doublon
                          while (1=1)
                          begin
                                 select top 1 @cadr_ident = cadr_ident
                                 from #doublon
                                 where train_id = @train_id

                                 if @@rowcount = 0
                                 begin
                                       break
                                 end

                                 -- on recupere l'identifiant de la ligne du cadre
                                 -- qui � la date de creation la plus recente
                                 select @ft_id = ft_id
                                 from tf_face_train f
                                 join ( select max(ft_dat_cre) as maxDate
                                              from tf_face_train
                                              where train_id = @train_id
                                              and cadr_ident = @cadr_ident) as sr on (f.ft_dat_cre = sr.maxDate)
                                 where f.train_id = @train_id
                                 and f.cadr_ident = @cadr_ident

                                 -- on met au statut annuler les lignes les autres lignes du cadre du train
                                 update tf_face_train
                                 set rpc_statut = 4,
                                       train_id = null,
                                       ft_dat_maj = @getdate,
                                       ft_user_maj = @user
                                 where train_id = @train_id
                                 and cadr_ident = @cadr_ident
                                 and ft_id <> @ft_id

                                 -- on supprime la ligne traiter pour les boucle suivantes
                                 delete from #doublon
                                 where train_id = @train_id
                                 and cadr_ident = @cadr_ident
                          end

                          -- la mise � jour pour la sortie de boucle est fait dans la boucle precedente
                    end
             end

             -- controle pour les doublons sur les afficheurs
             -- pour chaque train, s'il y a un doublon sur les afficheurs (pers_ident)
             -- on prend la ligne la plus recente en terme de creation

             -- on recupere la liste des doublons
             select f2.train_id
             into #doublonAff
             from tf_face_train f1
             join tf_face_train f2 on (f1.train_id = f2.train_id)
             where f1.instr_code = @instr_code
             and f2.train_id is not null
             and f2.ft_type <> 'entretien'
             group by f2.train_id
             having count(distinct f2.pers_ident) > 1

             if (@@rowcount > 0)
             begin
                    -- pour chaque train
                    while (1=1)
                    begin
                          select top 1 @train_id = train_id
                          from #doublonAff

                          if @@rowcount = 0
                          begin
                                 break
                          end

                          -- on recupere l'identifiant de la ligne du pers_ident
                          -- qui � la date de creation la plus recente
                          select @ft_id = f.ft_id,
                                 @pers_ident = f.pers_ident,
                                 @pers_nom = f.pers_nom
                          from tf_face_train f
                          join ( select max(ft_dat_cre) as maxDate
                                       from tf_face_train
                                       where train_id = @train_id) as sr on (f.ft_dat_cre = sr.maxDate)
                          where f.train_id = @train_id

                          -- on met a jour l'afficheur pour tout le train
                          update tf_face_train
                          set pers_ident = @pers_ident,
                                 pers_nom = @pers_nom,
                                 ft_dat_maj = @getdate,
                                 ft_user_maj = @user
                          where train_id = @train_id
                          and ft_id <> @ft_id

                          -- on supprime la ligne traiter pour les boucle suivantes
                          delete from #doublonAff
                          where train_id = @train_id
                    end
             end

             -- purge
             drop table #doublon
             drop table #doublonAff
       end

       --select * from  #t_instruction
       --select * from  #t_visuels
       --select * from  #t_detail
       --select * from  #face

       -- fin de la procedure
       return 0
end
;
;;
;

GO
/****** Object:  StoredProcedure [dbo].[p_u_atelier]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


create procedure [dbo].[p_u_atelier]
(
	@loginWindows	varchar(50) = null,
	@ate_id			smallint = null
)
as
begin
	-- description : mets a jour l'atelier par defaut de l'utilisateur
	--
	-- 2013.10.22	| Wheeler A.	| Creation

	update tr_utilisateur
	set ate_id = @ate_id
	where loginWindows = @loginWindows

	if @@error <> 0
		return -1
	
	-- fin de la procedure
	return 0
end
GO
/****** Object:  StoredProcedure [dbo].[p_u_batch]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


CREATE PROCEDURE [dbo].[p_u_batch]	( 
	@batch  sysname,
	@step	tinyint,
	@statut	char(2)		)
AS
/*-------------------------------------------------------------------------------*/
--  Procédure            : p_u_batch
--  Auteur               : AMS						  
--  Date de création     : 27/06/07                                     
--  Description 	 : maj de l'étape et du statut en cours de la dernière exécution d'un batch     	  
--  Auteur - Date - Nature modif. : 					  
--  	AMS - 27/06/07 - ...      	                        
--  Paramètres d'entrée  :      @batch - nom du batch (ps) à executer
--				@step	- étape du batch en cours,
--				@statut	- statut de l'étape du batch en cours  
--  Paramètres de sortie :      -                                        
--  Retour 		 : 	(=0 : OK) ; (!=0 - erreur fonctionnelle ou serveur)		
/*-------------------------------------------------------------------------------*/
BEGIN

declare @rowcount	int,
	@error		int

	if not exists ( select  1
			from	tt_batch
			where 	bat_batch = @batch )
	begin
		return 1
	end
	


	BEGIN TRAN 

	update 	tt_batch
	set 	bat_step = @step,
		bat_statut = @statut,
		bat_dat_exec = getdate()
	where 	bat_batch = @batch
		
	select @error = @@error
	if @error != 0 
	begin
		if @@trancount = 1
			ROLLBACK TRAN 
		return 1
	end
	
	COMMIT TRAN 
	
return
END

GO
/****** Object:  StoredProcedure [dbo].[p_u_DateAffMinUM]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
create procedure [dbo].[p_u_DateAffMinUM]
(
	@IdUm dbo.listeUMTableType readonly
)
as
begin	
	-- Description:	Met à jour la date des um avec la date minimum des repartitions associé
	--
	-- =============================================
	-- Date			| User			| Description
	-- -----------------------------------------------------------------------
	-- 2015.12.14	| Wheeler A.	| Création
	-- -----------------------------------------------------------------------
	
	-- declaration
	declare @minDate smalldatetime

	-- on recupere la date min d'affichage par UM
	update tf_UM
	set UM_date_aff = ss.mindate
	from tf_UM u
	join (	select t.UM_id, min(r.rpc_dat_aff) as mindate
			from @IdUm t 
			join tf_repart_calcul r on (t.UM_id = r.UM_id)
			group by t.UM_id) as ss on (u.UM_id = ss.UM_id)
	        
	-- comme on a UM_id qui se trouve dans la table tf_repart_calcul, on se peut pas lier toutes les données
	-- de tf_UM avec tf_repart_calcul, il faudrait une table de lien
	-- du coup on fait les mises à jour ci-dessous en plus

	-- on prend le min parmis les données mis à jour
	select @minDate = min(u.UM_date_aff)
	from tf_UM u
	join @IdUm t on (u.UM_id = t.UM_id)

	-- puis on met a jour les lignes qui n'ont pas de lien avec tf_repart_calcul
	update tf_UM
	set UM_date_aff = @minDate
	from tf_UM u
	join @IdUm t on (u.UM_id = t.UM_id)
	where u.UM_date_aff is null

	-- fin de la procedure
	return 0
end
GO
/****** Object:  StoredProcedure [dbo].[p_u_detail_colis]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[p_u_detail_colis] 
	@colisId        int
	

AS
BEGIN
	-- Description:	Affiche les détail d'un colis
	-- 
	-- Date			| User	| Description
	-- -----------------------------------------------------------------------
	-- 2015.06.22	| PCL.	| Création
	-- 2016.06.01	| Wheeler A.	| ajout de la mise a jour du colis code
	-- -----------------------------------------------------------------------

	-- mise à jour de l'adresse
	update tf_colis
	set adr_id = a.adr_id,
		adr_destinataire = d.dest_nom_ori,
		adr_num_voie = a.adr_num_voie ,
		adr_type_voie = a.adr_type_voie,
		adr_voie = a.adr_voie,
		adr_lieu_dit = a.adr_lieu_dit,
		adr_localite = a.adr_localite,
		adr_code_postal = a.adr_code_postal,
		adr_cedex = a.adr_cedex,
		colis_code = 'C-'+right('000000000000000000'+convert(varchar, c.colis_id),18)
	from tf_colis c
	join tr_destinataire d on (c.dest_id = d.dest_id)
	join tr_dest_adresse a on (c.dest_id = a.dest_id)
	where a.adr_principale = '1'
	and c.colis_id = @colisId

	-- mise à jour du transporteur
	update tf_colis
	set tsp_id = t.tsp_id, 
		tarif_code = t.tarif_code
	from tf_colis c
	join tr_ate_dest_trans t on (c.dest_id = t.dest_id
								and c.ate_id = t.ate_id)
	where c.colis_id = @colisId
	
	-- fin de la procedure
	return 0
END
GO
/****** Object:  StoredProcedure [dbo].[p_u_duplication_train]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE procedure [dbo].[p_u_duplication_train]
(
                @trainSource varchar (20),
                @trainCible varchar (20),
                @annonceur varchar(250),
                @nombreInsertion int,
				@user varchar (20)
)
as
begin 
declare @trainCibleInt bigint = 0;
declare @Id int = 0;
select  @trainCibleInt =  convert(bigint,@trainCible)

INSERT INTO
  [dbo].[tt_log]
  (log_date,log_module, log_desc,log_acteur)
  values
  (GETDATE(), 'duplication', CONCAT(@trainSource,'|',@trainCible,'|',@annonceur,'|',@nombreInsertion), @user)


CREATE TABLE #temp(
	[ft_id] [int] ,
	[dest_id] [int] NULL,
	[rpc_statut] [tinyint] NULL,
	[ate_id] [smallint] NULL,
	[sup_id] [smallint] NULL,
	[instr_code] [varchar](18) NOT NULL,
	[cadr_ident] [numeric](9, 0) NOT NULL,
	[cadre_lib] [varchar](30) NULL,
	[rdep_datdep] [smalldatetime] NOT NULL,
	[empl_ident] [numeric](9, 0) NULL,
	[pers_ident] [numeric](9, 0) NULL,
	[pers_nom] [varchar](50) NULL,
	[tyaf_code] [smallint] NULL,
	[reac_code] [tinyint] NULL,
	[typr_code] [tinyint] NULL,
	[cont_sembas] [tinyint] NULL,
	[cont_anbas] [smallint] NULL,
	[cont_num] [int] NULL,
	[cont_annonc] [varchar](30) NULL,
	[empl_sect_code] [smallint] NULL,
	[empl_depa_code] [char](2) NULL,
	[comm_numord] [smallint] NULL,
	[empl_numord] [smallint] NULL,
	[empl_addresse1] [varchar](30) NULL,
	[empl_addresse2] [varchar](30) NULL,
	[cadr_lettre] [char](1) NULL,
	[form_larg] [smallint] NULL,
	[form_haut] [smallint] NULL,
	[agreement] [varchar](50) NULL,
	[train] [tinyint] NULL,
	[rang] [tinyint] NULL,
	[rese_ident] [numeric](9, 0) NULL,
	[idre_nom] [varchar](50) NULL,
	[panel_ident] [numeric](9, 0) NULL,
	[ft_dat_cre] [datetime] NULL,
	[ft_dat_maj] [datetime] NULL,
	[ft_user_maj] [varchar](20) NULL,
	[theme] [varchar](50) NULL,
	[theme_id] [int] NULL,
	[repiquage] [varchar](50) NULL,
	[repiquage_id] [int] NULL,
	[commune] [varchar](50) NULL,
	[train_id] [varchar](20) NULL,
	[ordre_propose] [tinyint] NULL,
	[ordre_reel] [tinyint] NULL,
	[insv_id] [int] NULL,
	[dep_sembas] [tinyint] NULL,
	[dep_anbas] [smallint] NULL,
	[ft_type] [varchar](15) NULL,
	[version] [tinyint] NULL,
	[rouleur_id] [int] NULL,
	[colis_id] [int] NULL,
	[pre_assemblage] [bit] NULL DEFAULT ((0)),
	[IdFaceOTAffichage] [int] NULL,
	[CodeUniteUrbaine] [varchar](10) NULL,
	[Conservation] [int] NULL,
	[CoteCote] [tinyint] NULL,
	[Convention] [varchar](50) NULL,
	[RefConvention] [varchar](50) NULL,
	[IdTypeDossier] [int] NULL,
	[IdStructure] [int] NULL,
	[ordre_calcule] [int] NULL,
	[ordre_reel_initial] [int] NULL,
	[IdLienCoteCote] [int] NULL,
	[IdPanelDestination] [int] NULL,
	[RefPanel] [varchar](50) NULL,
	INSERTED int not null,
	)
declare @inserted int = 0;

insert into #temp (ft_id,pers_nom, train_id, dest_id,	rpc_statut,	ate_id,	sup_id,	instr_code,	cadr_ident,	cadre_lib,	rdep_datdep,	empl_ident,	pers_ident,	tyaf_code,	reac_code,	typr_code,	cont_sembas,	cont_anbas,	cont_num,	cont_annonc,	empl_sect_code,	empl_depa_code,	comm_numord,	empl_numord,	empl_addresse1,	empl_addresse2,	cadr_lettre,	form_larg,	form_haut,	agreement,	train,	rang,	rese_ident,	idre_nom,	panel_ident,	ft_dat_cre,	ft_dat_maj,	ft_user_maj,	theme,	theme_id,	repiquage,	repiquage_id,	commune,	ordre_propose,	ordre_reel,	insv_id,	dep_sembas,	dep_anbas,	ft_type,	version,	rouleur_id,	colis_id,	pre_assemblage,	IdFaceOTAffichage,	CodeUniteUrbaine,	Conservation,	CoteCote,	Convention,	RefConvention,	IdTypeDossier,	IdStructure,	ordre_calcule,	ordre_reel_initial,	IdLienCoteCote,	IdPanelDestination,	RefPanel,INSERTED)
select ft_id, @annonceur, train_id, dest_id,	5,	ate_id,	sup_id,	instr_code,	cadr_ident,	cadre_lib,	rdep_datdep,	empl_ident,	pers_ident,	tyaf_code,	reac_code,	typr_code,	cont_sembas,	cont_anbas,	cont_num,	cont_annonc,	empl_sect_code,	empl_depa_code,	comm_numord,	empl_numord,	empl_addresse1,	empl_addresse2,	cadr_lettre,	form_larg,	form_haut,	agreement,	train,	rang,	rese_ident,	idre_nom,	panel_ident,	ft_dat_cre,	ft_dat_maj,	ft_user_maj,	theme,	theme_id,	repiquage,	repiquage_id,	commune,	ordre_propose,	ordre_reel,	insv_id,	dep_sembas,	dep_anbas,	ft_type,	version,	rouleur_id,	colis_id,	pre_assemblage,	IdFaceOTAffichage,	CodeUniteUrbaine,	Conservation,	CoteCote,	Convention,	RefConvention,	IdTypeDossier,	IdStructure,	ordre_calcule,	ordre_reel_initial,	IdLienCoteCote,	IdPanelDestination,	RefPanel,0
from tf_face_train
where train_id = @trainSource

--select * from #temp order by ordre_calcule

while @inserted < @nombreInsertion
begin

	set @trainCibleInt = @trainCibleInt + 190

	insert into tf_face_train (pers_nom, train_id, dest_id,	rpc_statut,	ate_id,	sup_id,	instr_code,	cadr_ident,	cadre_lib,	rdep_datdep,	empl_ident,	pers_ident,	tyaf_code,	reac_code,	typr_code,	cont_sembas,	cont_anbas,	cont_num,	cont_annonc,	empl_sect_code,	empl_depa_code,	comm_numord,	empl_numord,	empl_addresse1,	empl_addresse2,	cadr_lettre,	form_larg,	form_haut,	agreement,	train,	rang,	rese_ident,	idre_nom,	panel_ident,	ft_dat_cre,	ft_dat_maj,	ft_user_maj,	theme,	theme_id,	repiquage,	repiquage_id,	commune,	ordre_propose,	ordre_reel,	insv_id,	dep_sembas,	dep_anbas,	ft_type,	version,	rouleur_id,	colis_id,	pre_assemblage,	IdFaceOTAffichage,	CodeUniteUrbaine,	Conservation,	CoteCote,	Convention,	RefConvention,	IdTypeDossier,	IdStructure,	ordre_calcule,	ordre_reel_initial,	IdLienCoteCote,	IdPanelDestination,	RefPanel)
	select @annonceur, @trainCibleInt,dest_id,	rpc_statut,	ate_id,	sup_id,	instr_code,	cadr_ident,	cadre_lib,	rdep_datdep,	empl_ident,	pers_ident,	tyaf_code,	reac_code,	typr_code,	cont_sembas,	cont_anbas,	cont_num,	cont_annonc,	empl_sect_code,	empl_depa_code,	comm_numord,	empl_numord,	empl_addresse1,	empl_addresse2,	cadr_lettre,	form_larg,	form_haut,	agreement,	train,	rang,	rese_ident,	idre_nom,	panel_ident,	GETDATE(),	GETDATE(),	@user,	theme,	theme_id,	repiquage,	repiquage_id,	commune,	ordre_propose,	ordre_reel,	insv_id,	dep_sembas,	dep_anbas,	ft_type,	version,	rouleur_id,	colis_id,	pre_assemblage,	IdFaceOTAffichage,	CodeUniteUrbaine,	Conservation,	CoteCote,	Convention,	RefConvention,	IdTypeDossier,	IdStructure,	ordre_calcule,	ordre_reel_initial,	IdLienCoteCote,	IdPanelDestination,	RefPanel
	from #temp
	
	set @inserted = @inserted + 1
end

drop table #temp

end

GO
/****** Object:  StoredProcedure [dbo].[p_u_expedie_Colis]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================
-- Author:		SJA
-- Create date: 09/02/2015
-- Description:	expédition d'un COLIS
-- =============================================
-- Date			| User			| Description
-- -----------------------------------------------------------------------
-- 09-02-2015	| SJA.	| Création
-- -----------------------------------------------------------------------

CREATE PROCEDURE [dbo].[p_u_expedie_Colis] 
	@colis_id			    int,
    @user                   varchar(20)
    
    
       
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	SET FMTONLY OFF;
    
   
    declare @log_module			varchar(50)
    declare @UmAExpedier        int
    
    select @user = upper (@user)
            
    -- initialisation
    select @log_module = OBJECT_NAME(@@PROCID)
   
   -- mise à jour du colis
   update tf_colis
   set rpc_statut = 7, colis_user = @user, colis_dat_maj = getdate()
   where colis_id = @colis_id
     
   if @@error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'expédition colis', @user
        return -1
	end
    
    -- mise à jour  des UM du colis si l'UM n'est pas rattaché
    -- à au moins un colis qui n'a pas encore été expédié
   -- On cherche les colis non éxépédiés
   --select @UmAExpedier = COUNT('')

	UPDATE tf_UM
	SET tf_UM.rpc_statut = 7, 
	UM_user = @user, 
	UM_dat_maj = getdate()
	FROM tf_UM, tf_UM_colis
	WHERE tf_UM.UM_id IN
	        (SELECT tf_UM.UM_id
			FROM tf_UM			  
			INNER JOIN tf_UM_colis on tf_UM_colis.UM_id = tf_UM.UM_id
			INNER JOIN tf_colis    on tf_colis.colis_id = tf_UM_colis.colis_id 
			WHERE tf_UM_colis.colis_id = @colis_id
				AND 
				NOT EXISTS (
					SELECT ''
					FROM tf_colis col
					WHERE tf_colis.colis_id = col.colis_id AND col.rpc_statut != 7
				))
   
   if @@error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'expédition UM', @user
        return -1
	end
 
   
-- fin de la procedure
return 0

END
GO
/****** Object:  StoredProcedure [dbo].[p_u_exportTheme]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


CREATE procedure [dbo].[p_u_exportTheme]
(
                @semaine    int,
                @annee      int,
                @atelier    int,
                @support    int,
                @mode_calcul  int,
				@pre_assemblage bit ,
                @user    varchar(50)
)
as
begin 
 --S?lection des trains en fonction de la semaine, l'ann?e et l'atelier.
declare @nombreTrainEnPrepa int = 0;


select train_id, SUM(CASE WHEN ISNULL(pre_assemblage,0) = 0 THEN 0 ELSE 1 END) NombreFaceEnPreAssemblage, COUNT(train_id) NombreTrain
into #travail
from tf_face_train t
where t.dep_anbas = @annee 
	  and t.dep_sembas = @semaine
	  and t.ate_id = @atelier
group by t.train_id


select tft.train_id ,tft.rpc_statut
into #temp
from tf_face_train tft
                join tr_atelier tra on (tft.ate_id = tra.ate_id)
                join tr_categorie_support trcs on (tft.sup_id = trcs.sup_id)
                join tr_statut trs on (tft.rpc_statut = trs.rpc_statut)
				left join #travail tr on tr.train_id = tft.train_id
where dep_sembas = @semaine 
                and dep_anbas = @annee 
				and ( ( @pre_assemblage = 1 AND isnull(tft.pre_assemblage,0) = isnull(@pre_assemblage,0) AND tr.NombreFaceEnPreAssemblage = tr.NombreTrain)
					 OR (isnull(@pre_assemblage,0) = 0)
					 )
                and tft.ate_id = @atelier  
 
--Mode de Calcul simple (Modification du statut)
if (@mode_calcul = 1)
begin 

--Modification du statut des trains en statut 'export pr?pa'.
				update tf_face_train
				   set rpc_statut = 9
                 from tf_face_train tf
				 left join #travail tr on tr.train_id = tf.train_id
				 where dep_sembas = @semaine 
				   and dep_anbas = @annee 
                   and ate_id = @atelier 
                   and sup_id = @support
                   and rpc_statut = 5
				   and (( @pre_assemblage = 1 AND isnull(pre_assemblage,0) = isnull(@pre_assemblage,0) AND tr.NombreFaceEnPreAssemblage = tr.NombreTrain)
					   OR (isnull(@pre_assemblage,0) = 0)
					   )

--Savoir qui modifie.
if @@error != 0
                begin
                               insert tt_log (log_date, log_module, log_desc, log_acteur)
                               select GETDATE(), 'p_u_controlleur', 'controlleur', @user
        return 1
                end

end

--Mode de Calcul complexe en fonction des param?tres.
else 
--Commencement
begin

--S?lection des 20 meilleurs th?mes
select top 20 theme, cont_annonc,count(theme) as 'CountTheme'
                into #train_20
from tf_face_train ft
left join #travail tr on tr.train_id = ft.train_id
where ate_id = @atelier
and cont_sembas = @semaine
and cont_anbas = @annee
and rpc_statut = 5 -- A imprimer
and sup_id = @support
and ft.train_id is not null
and (( @pre_assemblage = 1 AND isnull(pre_assemblage,0) = isnull(@pre_assemblage,0) AND tr.NombreFaceEnPreAssemblage = tr.NombreTrain)
		OR (isnull(@pre_assemblage,0) = 0)
	)

group by theme, cont_annonc

order by 3 desc


--S?lection des 20 meilleurs th?mes
select theme, cont_annonc,count(theme) as 'CountTheme'
                into #train_tous
from tf_face_train ft
left join #travail tr on tr.train_id = ft.train_id
where ate_id = @atelier
and cont_sembas = @semaine
and cont_anbas = @annee
and rpc_statut = 5 -- A imprimer
and sup_id = @support
and ft.train_id is not null
and (( @pre_assemblage = 1 AND isnull(pre_assemblage,0) = isnull(@pre_assemblage,0) AND tr.NombreFaceEnPreAssemblage = tr.NombreTrain)
		OR (isnull(@pre_assemblage,0) = 0)
	)
group by theme, cont_annonc
order by 2 desc

delete from #train_tous where CONCAT( cont_annonc, theme) in ( select CONCAT (cont_annonc, theme) from #train_20)

/*
select * from #train_20 
select * from #train_tous 

return
*/
select distinct ft.train_id 
into #train_to_update
from 
tf_face_train ft
left join #travail tr on tr.train_id = ft.train_id
where
dep_sembas = @semaine 
                and dep_anbas = @annee 
                and ate_id = @atelier 
                and sup_id = @support
                and rpc_statut = 5 -- A imprimer
                and ft.train_id is not null
                and CONCAT( cont_annonc, theme) in ( select CONCAT (cont_annonc, theme) from #train_20)
                and CONCAT( cont_annonc, theme) not in ( select CONCAT (cont_annonc, theme) from #train_tous)
				and (( @pre_assemblage = 1 AND isnull(pre_assemblage,0) = isnull(@pre_assemblage,0) AND tr.NombreFaceEnPreAssemblage = tr.NombreTrain)
						OR (isnull(@pre_assemblage,0) = 0)
					)

delete t from #train_to_update t
join tf_face_train tf on tf.train_id = t.train_id
where CONCAT( tf.cont_annonc, tf.theme) in ( select CONCAT (cont_annonc, theme) from #train_tous)

-- => Modification du statut.
update t 
set t.rpc_statut = 9
from tf_face_train t
join #train_to_update tu on t.train_id = tu.train_id

update tf_face_train set rpc_statut = 9 where train_id in (select train_id from #train_to_update)

drop table #travail

end

end
GO
/****** Object:  StoredProcedure [dbo].[p_u_harmonise_data]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE procedure [dbo].[p_u_harmonise_data]     
as
begin
	-- description : proc de regulation des donn�es
	-- 
	-- ?			| Jaoen S.		| creation
	-- 2017.02.02	| Wheeler A.	| it 41640 : regul des adresses pour certains destinataire
	-- 2017.02.02	| Wheeler A.	| it 42244 : regul probleme type support brest
	-- 2017.02.07	| Wheeler A.	| it 42498 : regul probleme type support brest dans l'autre format

	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	-- train sur 2 destinataires ! => �a, bloque le 
	create table #t 
	(
		train_id varchar (50) null,
		dest_id int  null
	)

	insert into #t ( train_id)
	select distinct train_id from tf_face_train
	where train_id is not null
	and rdep_datdep > getdate()
	group by train_id
	having count (distinct dest_id ) >1


	update #t set #t.dest_id = (Select min (tf_face_train.dest_id) 
								FROM tf_face_train 
								where #t.train_id = tf_face_train.train_id)
    
	update tf_face_train 
	set dest_id = #t.dest_id
	from #t
	where #t.train_id = tf_face_train.train_id
    
	-- pb de destinataires bloque exp�dition => MSP
	update tf_face_train set dest_id = 539 where dest_id = 540
	update tf_face_train set dest_id = 539 where dest_id = 568
	
	-- pb de destinataires bloque exp�dition => NARBONNE ROUSILLON
	update tf_face_train set dest_id = 196 where dest_id = 201
	update tf_face_train set dest_id = 196 where dest_id = 522

	-- pb de destinataires bloque exp�dition => VIAUD
	update tf_face_train set dest_id = 144 where dest_id = 483
	
		-- pb en validation d'instruction => ok mais pas de train_id (sur entretien uniquement)
	delete from tf_face_train where train_id is null and rpc_statut = 2
	

-- SJA => pb des apostrophes

update tf_face_train set cont_annonc = replace (cont_annonc,'''',' ')
where rdep_datdep > getdate()
and rpc_statut = 5
and charindex ('''',cont_annonc) >0


update tf_face_train set theme = replace (theme,'''',' ')
where rdep_datdep > getdate()
and rpc_statut = 5
and charindex ('''',theme) >0

update tf_face_train set repiquage = replace (repiquage,'''',' ')
where rdep_datdep > getdate()
and rpc_statut = 5
and charindex ('''',repiquage) >0

-- SJA => pb des trains sans destinataire
update tf_face_train set dest_id = 565
where rdep_datdep > getdate()
and rpc_statut = 5
and dest_id is null

update tf_face_train set dest_id = 565
where pers_nom = 'ENTRETIEN'
and rpc_statut = 5
and dest_id is null
    
   
    
	return 0
end
;
GO
/****** Object:  StoredProcedure [dbo].[p_u_numeroReception]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


create procedure [dbo].[p_u_numeroReception]
(
	@rpc_id				numeric(9,0) = null,
	@NumeroReception	varchar(20) = null
)
as
begin
	-- description : met a jour le numero de reception pour la repartition
	--
	-- 2013.10.24	| Wheeler A.	| Creation

	update tf_repart_calcul
	set numeroReception = @NumeroReception
	where rpc_id = @rpc_id

	if @@error <> 0
		return -1
	
	-- fin de la procedure
	return 0
end
GO
/****** Object:  StoredProcedure [dbo].[p_u_poidsColis]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[p_u_poidsColis]
(
	@colis_id int = 0
)
AS
begin
	-- description : calcul le poids d'un colis
	--
	-- ----------------------------------------
	-- 2016.03.15	| Wheeler A.	| creation
    -- 2016.03.22	| SJA			| le poids minimum c'est 1kg
	-- 2016.06.22	| Wheeler A.	| ajout de la gestion du poids quand c'est un colis avec des trains.
    -- 2016.08.29   SJA : correction calcul pour les trains.

	-- declaration
	declare @colis_poids float

if exists ( select 1 from tf_UM_colis where colis_id = @colis_id )

begin
	-- on calcule le poids
	select @colis_poids = sum(uc.uc_qte * convert(float, s.sup_poids))
	from tf_UM_colis uc
	join tf_UM u on (uc.UM_id = u.UM_id)
	join tr_categorie_support s on (u.sup_id = s.sup_id)
	where colis_id = @colis_id

end
else
	-- s'il n'a pas de données on regarde on essaye de calculer le poids pour les trains
	
	begin
		select @colis_poids = sum(ss.cnt * convert(float, c.sup_poids))
		from tr_categorie_support c
		join (select sup_id, count(*) as cnt
				from tf_face_train
				where colis_id = @colis_id
				group by sup_id) as ss on (c.sup_id = ss.sup_id)
	end

	-- controle
	if (@colis_poids is null
		or @colis_poids = 0)
	begin
		select @colis_poids = convert(float, sup_poids)
		from tr_categorie_support
		where sup_id = 0
	end

    -- SJA - Valeur par défaut 1 kg minimum pour Calberson !
    if @colis_poids < 1.0 
        select @colis_poids = 1.0

	-- on fait la mise a jour
	update tf_colis
	set colis_poids = @colis_poids
	where colis_id = @colis_id

    update tf_colis set colis_poids = colis_poids + 3.0 
    where ate_id in (7,8)
    and colis_id = @colis_id

	-- fin de la procedure
	return 0
end
GO
/****** Object:  StoredProcedure [dbo].[p_u_rpc_san_rep]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


create procedure [dbo].[p_u_rpc_san_rep]
(
	@rpc_id			numeric(9,0),
	@rpc_san_rep	char(1)
)
as
begin
	-- description : mets a jour la colonne rpc_san_rep
	--				ancienne colonne "Sans Repartition"
	--				desormais "colis unique"
	--
	-- 2013.11.07	| Wheeler A.	| Creation

	update tf_repart_calcul
	set rpc_san_rep = @rpc_san_rep
	where rpc_id = @rpc_id

	if @@error <> 0
		return -1
	
	-- fin de la procedure
	return 0
end
GO
/****** Object:  StoredProcedure [dbo].[p_u_statut_colis_UM]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[p_u_statut_colis_UM] 
	@colis_id			    int,
    @rpc_statut             tinyint,
    @user                   varchar(20)    
       
AS
BEGIN
	-- Description :	Modification de statut du colis et des UM rattachées
	-- 
	-- Date			| User			| Description
	-- -----------------------------------------------------------------------
	-- 2015.03.11	| PCL.			| Création
	
    declare @log_module			varchar(50)
    
    select @user = upper (@user)
            
    -- initialisation
    select @log_module = OBJECT_NAME(@@PROCID)
   
	-- mise à jour du colis
	update tf_colis
	set rpc_statut = @rpc_statut, 
		colis_user = @user,
		colis_dat_maj = getdate()
	where colis_id = @colis_id
     
   if @@error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'Maj du statut colis', @user
        return -1
	end
    
    -- mise à jour  des UM du colis
   update tf_UM
   set tf_UM.rpc_statut = @rpc_statut, 
   UM_user = @user, 
   UM_dat_maj = getdate()
   from tf_UM_colis
   INNER JOIN tf_UM ON tf_UM.UM_id = tf_UM_colis.UM_id
   where tf_UM_colis.colis_id = @colis_id
   
   if @@error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'Maj du statut UM', @user
        return -1
	end
   
-- fin de la procedure
return 0

END

GRANT EXECUTE ON dbo.p_u_statut_colis_UM TO user_circe
GO
/****** Object:  StoredProcedure [dbo].[p_u_statut_preparation]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE procedure [dbo].[p_u_statut_preparation]
(
	@instr_code	varchar(18),
    @code     smallint,
    @user       varchar(50)
)
as
begin

/* statut demandé pour passage */

    declare @log_module			varchar(50)

    select @user = upper (@user)
            
    -- initialisation
    select @log_module = OBJECT_NAME(@@PROCID)

    -- 0 A traiter  
    -- 1 En cours 
    -- 5 A préparer
    -- 4 Annulé

if @code = 0 or @code = 1 or @code = 5 or @code = 4
begin
    
    -- suppression des entretiens
    delete from tf_face_train 
    where instr_code = @instr_code
    and rpc_statut <> 5
    and ft_type = 'entretien'
    if @@error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'tf_face_train entretien', @user
        return 1
	end
    
    -- maj
    update tf_face_train 
    set rpc_statut  = @code ,
    ft_user_maj = @user, 
    ft_dat_maj = getdate(),
    theme = null,
    theme_id = null, 
    repiquage = null, 
    repiquage_id = null, 
    insv_id = null,
    train_id = null,
    version = null
    where instr_code = @instr_code
    and rpc_statut <> 5
    
	if @@error != 0
	begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, 'tf_face_train 0', @user
        return 1
	end
end

--2	Instructions ok
if @code = 2
    exec p_u_associe_train @instr_code, @user       
    
    if @@error != 0
        begin
		insert tt_log (log_date, log_module, log_desc, log_acteur)
		select GETDATE(), @log_module, ' p_u_associe_train', @user
        return 1
	end

--3	Erreur
--if @code = 3
    --select 'Erreur'   

return 0


	
	-- fin de la procedure
	return 0
end
GO
/****** Object:  StoredProcedure [dbo].[p_u_statut_repart_deblocage]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE procedure [dbo].[p_u_statut_repart_deblocage]
(
	@ident_repart	numeric(9,0),
	@rpfo_ident		numeric(9,0),
	@QuiModification varchar(30),
	@DateModification datetime
)
as
begin
	-------------------------------------------------------------------------------
	--  Procédure            : p_u_statut_repart_deblocage                	   	          
	--  Auteur               : Mahdi Baldé						  
	--  Date de création     : 18/06/2007                                     
	--  Description 	 : Met à jour le statut de la répartion suite à un deblocage.
	--              le rpc_statut passe à annulé @code_statut=4 
	--              les preparations correspondantes annulé ord_statut=4
	--              les colis correspondant annulé col_statut= 6     		  
	--  Auteur - Date - Nature modif. : 					  
	--  	AMS - 19/06/07 - ...      	                
	--  Paramètres d'entrée  :      
	--				@ident_repart - identifiant repartition                                      
	--  Paramètres de sortie :      -                                          
	--  Retour 		 : 	(=0 : OK) ; (!=0 - erreur fonctionnelle ou serveur)		
	-------------------------------------------------------------------------------
	-- 2013.11.13	| Wheeler A.	| correction suite à la suppression de la colonne col_id
	--				|				| dans tf_ordre_preparation
	-- 2017.05.02	| Wheeler A.	| us 401 : transmistion de la date et user de mise à jours pour que la date soit uniforme 
	--				|				| entre Broadcast et circe 

	declare @Error int

	begin transaction

	update tf_repart_calcul
	set rpc_statut = 4,
		rpc_dat_maj = @DateModification,
		rpc_user = @QuiModification
	where rpc_repartition = @ident_repart
	and rpc_rpfo_ident = @rpfo_ident
	and rpc_statut <> 4
	
	select @Error = @@error
    if (@Error<>0) 
		goto Erreur

	update tf_UM 
    set rpc_statut = 4,
		UM_dat_maj = @DateModification,
		UM_user = @QuiModification
	from tf_UM a
	join tf_repart_calcul b on (a.UM_id = b.UM_id)
    where b.rpc_repartition	= @ident_repart
	and b.rpc_rpfo_ident	= @rpfo_ident
	and a.rpc_statut <> 4

	select @Error = @@error
	if (@Error<>0) 
		goto Erreur
/*
	update tf_colis 
   	set col_statut = 6,
   		col_dat_maj = getdate()
	from tf_colis c
	join tf_ordre_preparation o on (c.ord_id = o.ord_id)
	join tf_repart_calcul r on (o.rpc_id = r.rpc_id)
    where r.rpc_repartition = @ident_repart
	and r.rpc_rpfo_ident	= @rpfo_ident
	and c.col_statut <> 6

	select @Error = @@error
    if (@Error<>0) 
		goto Erreur
*/
	commit transaction
	
	-- fin de la procedure
	return 0
		  
Erreur:
	if @Error <> 0
	BEGIN 
		ROLLBACK TRANSACTION
   	END

	-- fin de la procedure
	return -1
end
;
;
GO
/****** Object:  StoredProcedure [dbo].[P_UpdateAllLoginMigration]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[P_UpdateAllLoginMigration]
AS

SET NOCOUNT ON

select 'DEBUT UPDATE', getdate()

UPDATE photo 
SET user_creation = SUBSTRING(REPLACE(user_creation, 'CCI\','CITYZMEDIA\'), 0, 20)
where user_creation like ('CCI\%')
select 'UPDATE photo ', getdate(), @@rowcount

UPDATE ARCH_tf_repart_calcul 
SET rpc_user = SUBSTRING(REPLACE(rpc_user, 'CCI\','CITYZMEDIA\'), 0, 20)
where rpc_user like ('CCI\%')
select 'UPDATE ARCH_tf_repart_calcul ', getdate(), @@rowcount

UPDATE ARCH_tf_UM_colis
SET uc_user = SUBSTRING(REPLACE(uc_user, 'CCI\','CITYZMEDIA\'), 0, 20)
where uc_user like ('CCI\%')
select 'UPDATE ARCH_tf_UM_coli', getdate(), @@rowcount

UPDATE affiche 
SET user_creation = SUBSTRING(REPLACE(user_creation, 'CCI\','CITYZMEDIA\'), 0, 20)
where user_creation like ('CCI\%')
select 'UPDATE affiche ', getdate(), @@rowcount

UPDATE ARCH_tf_face_train 
SET ft_user_maj = SUBSTRING(REPLACE(ft_user_maj, 'CCI\','CITYZMEDIA\'), 0, 20)
where ft_user_maj like ('CCI\%')
select 'UPDATE ARCH_tf_face_train ', getdate(), @@rowcount

UPDATE ARCH_tf_colis
SET colis_user = SUBSTRING(REPLACE(colis_user, 'CCI\','CITYZMEDIA\'), 0, 20)
where colis_user like ('CCI\%')
select 'UPDATE ARCH_tf_colis', getdate(), @@rowcount

UPDATE instruction_visuels
SET insv_user = SUBSTRING(REPLACE(insv_user, 'CCI\','CITYZMEDIA\'), 0, 20)
where insv_user like ('CCI\%')
select 'UPDATE instruction_visuels', getdate(), @@rowcount

UPDATE ARCH_Tf_UM 
SET UM_user = SUBSTRING(REPLACE(UM_user, 'CCI\','CITYZMEDIA\'), 0, 20)
where UM_user like ('CCI\%')
select 'UPDATE ARCH_Tf_UM ', getdate(), @@rowcount

UPDATE tf_face_train
SET ft_user_maj = SUBSTRING(REPLACE(ft_user_maj, 'CCI\','CITYZMEDIA\'), 0, 20)
where ft_user_maj like ('CCI\%')
select 'UPDATE tf_face_train', getdate(), @@rowcount

UPDATE tmp_tf_colis
SET colis_user = SUBSTRING(REPLACE(colis_user, 'CCI\','CITYZMEDIA\'), 0, 20)
where colis_user like ('CCI\%')
select 'UPDATE tmp_tf_colis', getdate(), @@rowcount

UPDATE instruction_detail
SET insd_user = SUBSTRING(REPLACE(insd_user, 'CCI\','CITYZMEDIA\'), 0, 20)
where insd_user like ('CCI\%')
select 'UPDATE instruction_detail', getdate(), @@rowcount

UPDATE tf_colis
SET colis_user = SUBSTRING(REPLACE(colis_user, 'CCI\','CITYZMEDIA\'), 0, 20)
where colis_user like ('CCI\%')
select 'UPDATE tf_colis', getdate(), @@rowcount

UPDATE tf_train_export 
SET t_user_maj = SUBSTRING(REPLACE(t_user_maj, 'CCI\','CITYZMEDIA\'), 0, 20)
where t_user_maj like ('CCI\%')
select 'UPDATE tf_train_export ', getdate(), @@rowcount

UPDATE instruction_train
SET instr_user = SUBSTRING(REPLACE(instr_user, 'CCI\','CITYZMEDIA\'), 0, 20)
where instr_user like ('CCI\%')
select 'UPDATE instruction_train', getdate(), @@rowcount

UPDATE tr_adresseMail_plateforme
SET user_creation = SUBSTRING(REPLACE(user_creation, 'CCI\','CITYZMEDIA\'), 0, 20)
where user_creation like ('CCI\%')
select 'UPDATE tr_adresseMail_plateforme', getdate(), @@rowcount

UPDATE mouvement
SET user_creation = SUBSTRING(REPLACE(user_creation, 'CCI\','CITYZMEDIA\'), 0, 20)
where user_creation like ('CCI\%')
select 'UPDATE mouvement', getdate(), @@rowcount

UPDATE tf_repart_calcul 
SET rpc_user = SUBSTRING(REPLACE(rpc_user, 'CCI\','CITYZMEDIA\'), 0, 20)
where rpc_user like ('CCI\%')
select 'UPDATE tf_repart_calcul e', getdate(), @@rowcount

UPDATE tf_UM 
SET UM_user = SUBSTRING(REPLACE(UM_user, 'CCI\','CITYZMEDIA\'), 0, 20)
where UM_user like ('CCI\%')
select 'UPDATE tf_UM ', getdate(), @@rowcount

UPDATE tr_dest_adresse
SET adr_user_maj = SUBSTRING(REPLACE(adr_user_maj, 'CCI\','CITYZMEDIA\'), 0, 20)
where adr_user_maj like ('CCI\%')
select 'UPDATE tr_dest_adresse', getdate(), @@rowcount

UPDATE tr_destinataire
SET dest_user = SUBSTRING(REPLACE(dest_user, 'CCI\','CITYZMEDIA\'), 0, 20)
where dest_user like ('CCI\%')
select 'UPDATE tr_destinataire', getdate(), @@rowcount

UPDATE tf_UM_colis
SET uc_user = SUBSTRING(REPLACE(uc_user, 'CCI\','CITYZMEDIA\'), 0, 20)
where uc_user like ('CCI\%')
select 'UPDATE tf_UM_colis', getdate(), @@rowcount


select 'FIN UPDATE', getdate()
GO
/****** Object:  StoredProcedure [dbo].[p_updateColisTransporteur]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROC [dbo].[p_updateColisTransporteur]
	
AS

SET FMTONLY OFF
SET NOCOUNT ON;
declare @dateIntegration datetime = getdate();

--selectionner le dernier état pour chauqe colis
select refUniExp, Max(dateInsertion) as DateInsertion
into #UniqueId
from log_colis_transporteur
group by refUniExp

-- mettre a jour les colis dans la table tf_colis_ext
update tf_colis_ext 
set
tf_colis_ext.refUniEnl          = colTrans.refUniEnl,
tf_colis_ext.codeClient         = colTrans.codeClient,
tf_colis_ext.noRecepisse        = colTrans.noRecepisse,
tf_colis_ext.reference1         = colTrans.reference1,
tf_colis_ext.dateDepart         = colTrans.dateDepart,
tf_colis_ext.adresse1Exp        = colTrans.adresse1Exp,
tf_colis_ext.adresse2Exp        = colTrans.adresse2Exp,
tf_colis_ext.codePostalExp      = colTrans.codePostalDest,
tf_colis_ext.villeExp           = colTrans.villeExp,
tf_colis_ext.dateLivraison      = colTrans.dateLivraison,
tf_colis_ext.libelleLivraison   = colTrans.libelleLivraison,
tf_colis_ext.nomDest            = colTrans.nomDest,
tf_colis_ext.adresse1Dest       = colTrans.adresse1Dest,
tf_colis_ext.adresse2Dest       = colTrans.adresse2Dest,
tf_colis_ext.codePostalDest     = colTrans.codePostalDest,
tf_colis_ext.villeDest          = colTrans.villeDest,
tf_colis_ext.dateEtat           = colTrans.dateEtat,
tf_colis_ext.libelleEtat        = colTrans.libelleEtat,
tf_colis_ext.urlImageLivraison  = colTrans.urlImageEnlevementLivraison,
tf_colis_ext.urlPreuveLivraison = colTrans.urlPreuveService,
tf_colis_ext.dateIntegration    = @dateIntegration
from log_colis_transporteur colTrans
inner join #UniqueId colUniq on colUniq.refUniExp = colTrans.refUniExp and colUniq.DateInsertion = colTrans.dateInsertion
where tf_colis_ext.refUniExp = colTrans.refUniExp

-- ajouter les nouveaux colis dans la table tf_colis_ext
insert into tf_colis_ext 
(tf_colis_ext.refUniExp,
tf_colis_ext.refUniEnl,
tf_colis_ext.codeClient, 
tf_colis_ext.noRecepisse,
tf_colis_ext.reference1,
tf_colis_ext.dateDepart, 
tf_colis_ext.adresse1Exp,
tf_colis_ext.adresse2Exp,
tf_colis_ext.codePostalExp,
tf_colis_ext.villeExp,
tf_colis_ext.dateLivraison,
tf_colis_ext.libelleLivraison,
tf_colis_ext.nomDest,
tf_colis_ext.adresse1Dest,
tf_colis_ext.adresse2Dest,
tf_colis_ext.codePostalDest,
tf_colis_ext.villeDest,
tf_colis_ext.dateEtat,
tf_colis_ext.libelleEtat,
tf_colis_ext.urlImageLivraison,
tf_colis_ext.urlPreuveLivraison,
tf_colis_ext.dateIntegration)
select
colTrans.refUniExp,
colTrans.refUniEnl,
colTrans.codeClient,
colTrans.noRecepisse,
colTrans.reference1,
colTrans.dateDepart,
colTrans.adresse1Exp,
colTrans.adresse2Exp,
colTrans.codePostalDest,
colTrans.villeExp,
colTrans.dateLivraison,
colTrans.libelleLivraison,
colTrans.nomDest,
colTrans.adresse1Dest,
colTrans.adresse2Dest,
colTrans.codePostalDest,
colTrans.villeDest,
colTrans.dateEtat,
colTrans.libelleEtat,
colTrans.urlImageEnlevementLivraison,
colTrans.urlPreuveService,
@dateIntegration
from log_colis_transporteur colTrans
inner join #UniqueId colUniq on colUniq.refUniExp = colTrans.refUniExp and colUniq.DateInsertion = colTrans.dateInsertion
where colTrans.refUniExp not in (select refUniExp from tf_colis_ext)

-- update date integration dans la table log_colis_transporteur
update log_colis_transporteur 
set dateIntegration = @dateIntegration
From log_colis_transporteur 
inner join #UniqueId on log_colis_transporteur.refUniExp = #UniqueId.refUniExp and log_colis_transporteur.dateInsertion = #UniqueId.DateInsertion


update cls 
SET
cls.ref_uni_exp          = clsext.refUniExp,
cls.ref_uni_enl          = clsext.refUniEnl,
cls.code_client          = clsext.codeClient,
cls.no_recepisse         = clsext.noRecepisse,
cls.date_depart          = clsext.dateDepart,
cls.adresse_1_exp        = clsext.adresse1Exp,
cls.adresse_2_exp        = clsext.adresse2Exp,
cls.code_postal_exp      = clsext.codePostalExp,
cls.ville_exp            = clsext.villeExp,
cls.date_livraison       = clsext.dateLivraison,
cls.libelle_livraison    = clsext.libelleLivraison,
cls.nom_dest             = clsext.nomDest,
cls.adresse_1_dest       = clsext.adresse1Dest,
cls.adresse_2_dest       = clsext.adresse2Dest,
cls.code_postal_dest     = clsext.codePostalDest,
cls.ville_dest           = clsext.villeDest,
cls.date_etat            = clsext.dateEtat,
cls.libelle_etat         = clsext.libelleEtat,
cls.url_image_livraison  = clsext.urlImageLivraison,
cls.url_preuve_livraison = clsext.urlPreuveLivraison
from tf_colis cls
inner join tf_colis_ext clsext
on  cls.ref_uni_exp = clsext.refUniExp
where cls.ref_uni_exp = clsext.refUniExp and cls.colis_code = clsext.reference1

--update colis CIRCE
Create Table #ColisStatutRecent(ordreStatut int,
referenceColis varchar(50))

insert into #ColisStatutRecent(ordreStatut,referenceColis)
select isNull(max(statut.Ordre), 0), reference1
--statut.Libelle, 
  from tf_colis colis 
inner join tf_colis_ext colisext on colis.colis_code = reference1
left join tr_statut_colis statut on statut.Libelle = colisext.libelleEtat
group by reference1

update colis set
colis.ref_uni_enl = colis_ext.refUniEnl,
colis.ref_uni_exp = colis_ext.refUniExp,
colis.code_client = colis_ext.codeClient,
colis.no_recepisse = colis_ext.noRecepisse,
colis.date_depart = colis_ext.dateDepart,
colis.adresse_1_exp = colis_ext.adresse1Exp,
colis.adresse_2_exp = colis_ext.adresse2Exp,
colis.code_postal_exp = colis_ext.codePostalExp,
colis.ville_exp = colis_ext.villeExp,
colis.date_livraison = colis_ext.dateLivraison,
colis.libelle_livraison = colis_ext.libelleLivraison,
colis.nom_dest = colis_ext.nomDest,
colis.adresse_1_dest = colis_ext.adresse1Dest,
colis.adresse_2_dest = colis_ext.adresse2Dest,
colis.code_postal_dest = colis_ext.codePostalDest,
colis.ville_dest = colis_ext.villeDest,
colis.date_etat = colis_ext.dateEtat,
colis.libelle_etat = colis_ext.libelleEtat,
colis.url_image_livraison = colis_ext.urlImageLivraison,
colis.url_preuve_livraison = colis_ext.urlPreuveLivraison
from tf_colis colis 
inner join #ColisStatutRecent colisStatut on colis.colis_code = colisStatut.referenceColis
inner join tr_statut_colis statut on colisStatut.ordreStatut = statut.Ordre
inner join tf_colis_ext colis_ext on colis_ext.reference1 = colisStatut.referenceColis and colis_ext.libelleEtat = statut.Libelle

GO
/****** Object:  StoredProcedure [dbo].[p_valid_amt_reparts]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[p_valid_amt_reparts]	(
	@lnk_srv	sysname,
	@lnk_db		sysname	)
AS
/*-------------------------------------------------------------------------------*/
--  Procédure            : p_valid_amt_reparts
--  Auteur               : PDUC						  
--  Date de création     : 04/07/07                                   
--  Description 	 : phase 3 du traitement des répartitions - 
--				maj des lignes de repartition (et destinations a valider) traitées des tables log AMT
--				maj des lignes de repartition et destinations traitées des tables log PTF   	
--  Auteur - Date - Nature modif. : 					  
--  	AMS - 09/07/07 - ...      	                
--  Paramètres d'entrée  :      @lnk_srv - serveur linked AMT
--				@lnk_db	 - base AMT du serveur linked 
--  Paramètres de sortie :      -                                          
--  Retour 		 : 	(=0 : OK) ; (!=0 - erreur fonctionnelle ou serveur)		
/*-------------------------------------------------------------------------------*/
BEGIN

declare @error		int,
	@sql 		varchar(4000),
	@dat_trait	t_dat
	
	select @dat_trait = getdate()

	-- archivage des données traitées dans amt
	-- concerne seulement les répartitions, les destinations sont conservées dans amt - a valider 
	select @sql='insert into ' + @lnk_srv + '.' + @lnk_db + '.dbo.th_amt_log_repart (
				rpfo_ident,
   				pers_ident,
   				tyaf_code,
   				rpli_datdep,
   				afch_ident,
   				dat_trait,
   				tald_type,
   				tald_soci_code,
   				tald_code,
   				repa_ident,
   				pers_nom,
   				reac_code,
   				typr_code,
   				rpli_anbas,
   				rpli_sembas,
   				soci_code,
   				sect_code,
   				afch_lib,
   				cont_annonc,
   				rpty_qte_affich,
   				talr_trait )
			select 	
				trr.rpfo_ident,
   				trr.pers_ident,
   				trr.tyaf_code,
   				trr.rpli_datdep,
   				trr.afch_ident,
   				getdate(),
   				trr.tald_type,
   				trr.tald_soci_code,
   				trr.tald_code,
   				trr.repa_ident,
   				trr.pers_nom,
   				trr.reac_code,
   				trr.typr_code,
   				trr.rpli_anbas,
   				trr.rpli_sembas,
   				trr.soci_code,
   				trr.sect_code,
   				trr.afch_lib,
   				trr.cont_annonc,
   				trr.rpty_qte_affich, 
				1		-- statut traité
			from 	' + @lnk_srv + '.' + @lnk_db + '.dbo.tra_amt_log_repart trr,
				tw_amt_log_repart twr
 			where 	trr.talr_trait = 0
			and 	twr.rpfo_ident = trr.rpfo_ident
			and 	twr.pers_ident = trr.pers_ident
			and 	twr.tyaf_code = trr.tyaf_code
			and 	twr.rpli_datdep = trr.rpli_datdep
			and 	twr.afch_ident = trr.afch_ident
			and 	twr.talr_trait = 1  -- en cours intégration
			if @@error != 0
				return
			delete 	' + @lnk_srv + '.' + @lnk_db + '.dbo.tra_amt_log_repart
			from 	' + @lnk_srv + '.' + @lnk_db + '.dbo.tra_amt_log_repart trr,
				tw_amt_log_repart twr
 			where 	trr.talr_trait = 0
			and 	twr.rpfo_ident = trr.rpfo_ident
			and 	twr.pers_ident = trr.pers_ident
			and 	twr.tyaf_code = trr.tyaf_code
			and 	twr.rpli_datdep = trr.rpli_datdep
			and 	twr.afch_ident = trr.afch_ident
			and 	twr.talr_trait = 1  -- en cours intégration   '
	exec(@sql)
	select @error=@@error
	if @error != 0
	begin
		return 1
	end

	BEGIN TRAN 

	-- archivage des données répartitions traitées dans ptf
	insert into th_amt_log_repart (
				rpfo_ident,
   				pers_ident,
   				tyaf_code,
   				rpli_datdep,
   				afch_ident,
   				dat_trait,
   				tald_type,
   				tald_soci_code,
   				tald_code,
   				repa_ident,
   				pers_nom,
   				reac_code,
   				typr_code,
   				rpli_anbas,
   				rpli_sembas,
   				soci_code,
   				sect_code,
   				afch_lib,
   				cont_annonc,
   				rpty_qte_affich,
   				talr_trait ) 
	select 			
				twr.rpfo_ident,
   				twr.pers_ident,
   				twr.tyaf_code,
   				twr.rpli_datdep,
   				twr.afch_ident,
   				@dat_trait,
   				twr.tald_type,
   				twr.tald_soci_code,
   				twr.tald_code,
   				twr.repa_ident,
   				twr.pers_nom,
   				twr.reac_code,
   				twr.typr_code,
   				twr.rpli_anbas,
   				twr.rpli_sembas,
   				twr.soci_code,
   				twr.sect_code,
   				twr.afch_lib,
   				twr.cont_annonc,
   				twr.rpty_qte_affich, 
				1		-- statut traité
	from 	tw_amt_log_repart twr
 	where 	twr.talr_trait = 1	  -- en cours intégration

	select @error=@@error
	if @error != 0
	begin
		if @@trancount = 1
			ROLLBACK TRAN
		return 1
	end

	delete 	tw_amt_log_repart 
 	where 	talr_trait = 1	  -- en cours intégration

	select @error=@@error
	if @error != 0
	begin
		if @@trancount = 1
			ROLLBACK TRAN
		return 1
	end

	-- archivage des données destinations traitées dans ptf
	insert into th_amt_log_destination (
				tald_type,
   				tald_soci_code,
   				tald_code,
   				dat_trait,
   				dest_nom,
   				dest_numvoie,
   				dest_voie,
   				dest_voiesuite,
   				dest_codpost,
   				dest_commune,
   				dest_burdistrib,
   				dest_tel,
   				dest_fax,
   				dest_email  ) 
	select 			
				tald_type,
   				tald_soci_code,
   				tald_code,
   				@dat_trait,
   				dest_nom,
   				dest_numvoie,
   				dest_voie,
   				dest_voiesuite,
   				dest_codpost,
   				dest_commune,
   				dest_burdistrib,
   				dest_tel,
   				dest_fax,
   				dest_email
	from 	tw_amt_log_destination 

	select @error=@@error
	if @error != 0
	begin
		if @@trancount = 1
			ROLLBACK TRAN
		return 1
	end

	delete 	tw_amt_log_destination  

	select @error=@@error
	if @error != 0
	begin
		if @@trancount = 1
			ROLLBACK TRAN
		return 1
	end


	COMMIT TRAN


return
END



GO
/****** Object:  StoredProcedure [dbo].[purgeTravInstructionDetail]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[purgeTravInstructionDetail]
as
begin
	--  description : proc de purge de la table de travail 
	--				de preparation pour les scro
	--
	-- 2017.05.11	| Wheeler A.	| creation
	
	-- on purge les données precedentes
	delete from tra_amt_log_instruc_det

	return 0
end
;
GO
/****** Object:  StoredProcedure [dbo].[purgeTravInstructions]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[purgeTravInstructions]
as
begin
	--  description : proc de purge de la table de travail 
	--				des instructions
	--
	-- 2017.06.29	| SAMMARI M.	| creation
	
	-- on purge les données precedentes
	delete from tra_amt_log_instruction

	return 0
end
;
GO
/****** Object:  StoredProcedure [dbo].[purgeTravTrainAffiche]    Script Date: 03/11/2026 10:34:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
create procedure [dbo].[purgeTravTrainAffiche]
as
begin
	--  description : proc de purge des données de la table de travail 
	--				des trains d'affiches
	--
	-- 2017.05.11	| Wheeler A.	| creation
	
	-- on purge les données precedentes
	delete from trav_trainAffiche

	return 0
end
;
GO
